import { dateStr, json, query, withUser } from "@/lib/api";
import { all, get } from "@/lib/db";
import { financeFacts } from "@/lib/finance-server";
import type {
  Activity,
  DashboardData,
  DiaryEntry,
  Exercise,
  FitnessDay,
  Reminder,
  WorkoutSession,
} from "@/lib/types";
import { addDays, expandReminders, sum, today } from "@/lib/utils";

/** Consecutive days (ending today) with any logged activity, diary or workout. */
function currentStreak(userId: string): number {
  const marked = new Set(
    all<{ date: string }>(
      `SELECT DISTINCT date FROM (
         SELECT date FROM activities      WHERE user_id = ? AND completed = 1
         UNION SELECT date FROM diary_entries   WHERE user_id = ?
         UNION SELECT date FROM workout_sessions WHERE user_id = ?
       )`,
      userId,
      userId,
      userId,
    ).map((row) => row.date),
  );

  let streak = 0;
  for (let cursor = today(); marked.has(cursor); cursor = addDays(cursor, -1)) {
    streak += 1;
    if (streak > 400) break; // safety valve
  }
  return streak;
}

export const GET = withUser(async (user, request) => {
  const day = dateStr(query(request).get("date"), today());

  // ── Today's schedule ────────────────────────────────────────────────────
  const activities = all<Activity>(
    `SELECT * FROM activities WHERE user_id = ? AND date = ? ORDER BY start_time`,
    user.id,
    day,
  );

  // ── Upcoming reminders (today + next 7 days) ────────────────────────────
  const reminderRows = all<Reminder & { completions: string | null }>(
    `SELECT r.*, (
       SELECT group_concat(date) FROM reminder_completions c WHERE c.reminder_id = r.id
     ) AS completions
     FROM reminders r WHERE r.user_id = ?`,
    user.id,
  );

  const occurrences = expandReminders(
    reminderRows.map((row) => ({
      ...row,
      completions: row.completions ? row.completions.split(",") : [],
    })),
    day,
    addDays(day, 7),
  );

  const todaysReminders = occurrences.filter((o) => o.occurrence_date === day);

  // ── Today's workout ─────────────────────────────────────────────────────
  const sessionRow = get<Omit<WorkoutSession, "exercises">>(
    `SELECT id, date, name, muscle_group, notes, created_at
       FROM workout_sessions WHERE user_id = ? AND date = ?
      ORDER BY created_at DESC LIMIT 1`,
    user.id,
    day,
  );

  const workout: WorkoutSession | null = sessionRow
    ? {
        ...sessionRow,
        exercises: all<Exercise>(
          `SELECT * FROM workout_exercises WHERE session_id = ? ORDER BY position, rowid`,
          sessionRow.id,
        ),
      }
    : null;

  // ── Most recent diary entry ─────────────────────────────────────────────
  const diaryRow = get<DiaryEntry & { tags: string }>(
    `SELECT * FROM diary_entries WHERE user_id = ? ORDER BY date DESC, created_at DESC LIMIT 1`,
    user.id,
  );
  const diary: DiaryEntry | null = diaryRow
    ? { ...diaryRow, tags: JSON.parse(diaryRow.tags || "[]") as string[] }
    : null;

  // ── Finance ─────────────────────────────────────────────────────────────
  const facts = financeFacts(user.id, day);
  const spentToday =
    get<{ total: number | null }>(
      `SELECT SUM(amount) AS total FROM expenses WHERE user_id = ? AND date = ?`,
      user.id,
      day,
    )?.total ?? 0;

  // ── Fitness ─────────────────────────────────────────────────────────────
  const fitness =
    get<FitnessDay>(
      `SELECT date, provider, steps, calories, distance_km, active_minutes, resting_hr, workout_count
         FROM fitness_daily WHERE user_id = ? AND date <= ?
        ORDER BY date DESC LIMIT 1`,
      user.id,
      day,
    ) ?? null;

  // ── Progress score for the day ──────────────────────────────────────────
  const activitiesDone = activities.filter((a) => a.completed === 1).length;
  const remindersDone = todaysReminders.filter((r) => r.is_completed).length;
  const exercisesDone = workout
    ? workout.exercises.filter((e) => e.completed === 1).length
    : 0;
  const exercisesTotal = workout ? workout.exercises.length : 0;
  const diaryWritten = Boolean(diary && diary.date === day);
  const budgetOk = facts.limit <= 0 || facts.spent <= facts.expectedPace;

  const parts: number[] = [];
  if (activities.length > 0) parts.push(activitiesDone / activities.length);
  if (todaysReminders.length > 0)
    parts.push(remindersDone / todaysReminders.length);
  if (exercisesTotal > 0) parts.push(exercisesDone / exercisesTotal);
  parts.push(diaryWritten ? 1 : 0);
  parts.push(budgetOk ? 1 : 0);

  const data: DashboardData = {
    date: day,
    activities,
    reminders: occurrences.filter((o) => !o.is_completed).slice(0, 8),
    workout,
    diary,
    finance: {
      settings: facts.settings,
      spent_month: facts.spent,
      spent_today: spentToday,
      remaining: facts.remaining,
      daily_allowance: Math.max(0, facts.dailyLeft),
      by_category: facts.byCategory.map(({ category, total }) => ({
        category,
        total,
      })),
    },
    fitness,
    progress: {
      activities_done: activitiesDone,
      activities_total: activities.length,
      reminders_done: remindersDone,
      reminders_total: todaysReminders.length,
      exercises_done: exercisesDone,
      exercises_total: exercisesTotal,
      diary_written: diaryWritten,
      budget_ok: budgetOk,
      score: parts.length > 0 ? Math.round((sum(parts) / parts.length) * 100) : 0,
    },
    streak: currentStreak(user.id),
  };

  return json(data);
});
