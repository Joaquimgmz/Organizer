import { body, dateStr, fail, json, num, str, withUser } from "@/lib/api";
import { all, run } from "@/lib/db";
import type { GoalContribution, SavingsGoal } from "@/lib/types";
import { nowIso, today, uid } from "@/lib/utils";

type GoalRow = Omit<SavingsGoal, "contributions">;

/** Goals with their contribution history attached in one extra query. */
export async function loadGoals(userId: string): Promise<SavingsGoal[]> {
  const goals = await all<GoalRow>(
    `SELECT id, title, target_amount, target_date, notes, created_at
       FROM savings_goals WHERE user_id = ? ORDER BY created_at`,
    userId,
  );
  if (goals.length === 0) return [];

  const placeholders = goals.map(() => "?").join(", ");
  const contributions = await all<GoalContribution>(
    `SELECT id, goal_id, amount, date, note, created_at
       FROM goal_contributions
      WHERE user_id = ? AND goal_id IN (${placeholders})
      ORDER BY date DESC, created_at DESC`,
    userId,
    ...goals.map((goal) => goal.id),
  );

  const grouped = new Map<string, GoalContribution[]>();
  for (const row of contributions) {
    if (!grouped.has(row.goal_id)) grouped.set(row.goal_id, []);
    grouped.get(row.goal_id)!.push(row);
  }

  return goals.map((goal) => ({
    ...goal,
    contributions: grouped.get(goal.id) ?? [],
  }));
}

export const GET = withUser(async (user) =>
  json({ goals: await loadGoals(user.id) }),
);

export const POST = withUser(async (user, request) => {
  const input = await body<Record<string, unknown>>(request);

  const title = str(input.title);
  if (!title) return fail("Name what you're saving for.");

  const target = Math.round(Math.max(0, num(input.target_amount)) * 100) / 100;
  if (target <= 0) return fail("Set a target amount greater than zero.");

  // A deadline is optional, but it has to be in the future to mean anything.
  let targetDate: string | null = null;
  if (typeof input.target_date === "string" && input.target_date) {
    targetDate = dateStr(input.target_date, today());
    if (targetDate < today()) return fail("The target date is already past.");
  }

  const id = uid("g_");
  await run(
    `INSERT INTO savings_goals (id, user_id, title, target_amount, target_date, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    id,
    user.id,
    title,
    target,
    targetDate,
    str(input.notes),
    nowIso(),
  );

  // An amount already put aside is recorded as the first contribution.
  const saved = Math.round(Math.max(0, num(input.saved_amount)) * 100) / 100;
  if (saved > 0) {
    await run(
      `INSERT INTO goal_contributions (id, goal_id, user_id, amount, date, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      uid("gc_"),
      id,
      user.id,
      saved,
      today(),
      "Already saved",
      nowIso(),
    );
  }

  return json({ id }, 201);
});
