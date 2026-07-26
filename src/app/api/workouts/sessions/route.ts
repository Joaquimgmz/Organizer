import { body, dateStr, fail, json, num, query, str, withUser } from "@/lib/api";
import { all, get, run, transaction } from "@/lib/db";
import type {
  Exercise,
  TemplateExercise,
  WorkoutSession,
} from "@/lib/types";
import { addDays, nowIso, today, uid } from "@/lib/utils";

/** Attach exercises to a list of sessions in one extra query. */
function withExercises(
  userId: string,
  sessions: Omit<WorkoutSession, "exercises">[],
): WorkoutSession[] {
  if (sessions.length === 0) return [];

  const placeholders = sessions.map(() => "?").join(", ");
  const exercises = all<Exercise>(
    `SELECT * FROM workout_exercises WHERE user_id = ? AND session_id IN (${placeholders})
      ORDER BY position, rowid`,
    userId,
    ...sessions.map((s) => s.id),
  );

  const grouped = new Map<string, Exercise[]>();
  for (const exercise of exercises) {
    if (!grouped.has(exercise.session_id)) grouped.set(exercise.session_id, []);
    grouped.get(exercise.session_id)!.push(exercise);
  }

  return sessions.map((session) => ({
    ...session,
    exercises: grouped.get(session.id) ?? [],
  }));
}

export const GET = withUser(async (user, request) => {
  const params = query(request);
  const to = dateStr(params.get("to"), today());
  const from = dateStr(params.get("from"), addDays(to, -60));

  const rows = all<Omit<WorkoutSession, "exercises">>(
    `SELECT id, date, name, muscle_group, notes, created_at
       FROM workout_sessions WHERE user_id = ? AND date BETWEEN ? AND ?
      ORDER BY date DESC, created_at DESC`,
    user.id,
    from,
    to,
  );

  return json({ sessions: withExercises(user.id, rows) });
});

export const POST = withUser(async (user, request) => {
  const input = await body<{
    date?: unknown;
    name?: unknown;
    muscle_group?: unknown;
    notes?: unknown;
    template_id?: unknown;
    exercises?: TemplateExercise[];
  }>(request);

  let name = str(input.name);
  let muscleGroup = str(input.muscle_group) || "full body";
  let exercises: TemplateExercise[] = Array.isArray(input.exercises)
    ? input.exercises
    : [];

  // Starting from a template copies its exercise list into the new session.
  const templateId = str(input.template_id);
  if (templateId) {
    const template = get<{
      name: string;
      muscle_group: string;
      exercises: string;
    }>(
      `SELECT name, muscle_group, exercises FROM workout_templates
        WHERE id = ? AND user_id = ?`,
      templateId,
      user.id,
    );
    if (!template) return fail("Template not found.", 404);

    name = name || template.name;
    muscleGroup = str(input.muscle_group) || template.muscle_group;
    if (exercises.length === 0) {
      exercises = JSON.parse(template.exercises || "[]") as TemplateExercise[];
    }
  }

  if (!name) return fail("Give the workout a name.");

  const id = uid("w_");
  const stamp = nowIso();

  transaction(() => {
    run(
      `INSERT INTO workout_sessions (id, user_id, date, name, muscle_group, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      id,
      user.id,
      dateStr(input.date, today()),
      name,
      muscleGroup,
      str(input.notes),
      stamp,
    );

    exercises.forEach((exercise, index) => {
      run(
        `INSERT INTO workout_exercises
           (id, session_id, user_id, name, sets, reps, weight, rest_seconds, completed, position)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
        uid("x_"),
        id,
        user.id,
        str(exercise.name) || "Exercise",
        Math.max(1, Math.round(num(exercise.sets, 3))),
        Math.max(1, Math.round(num(exercise.reps, 10))),
        Math.max(0, num(exercise.weight, 0)),
        Math.max(0, Math.round(num(exercise.rest_seconds, 90))),
        index,
      );
    });
  });

  return json({ id }, 201);
});
