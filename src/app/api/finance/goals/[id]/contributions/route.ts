import { body, dateStr, fail, json, num, str, withUser } from "@/lib/api";
import { get, run } from "@/lib/db";
import { nowIso, today, uid } from "@/lib/utils";

type Ctx = { params: Promise<{ id: string }> };

/** Put money aside towards a goal. Negative amounts correct a mistake. */
export const POST = withUser<Ctx>(async (user, request, { params }) => {
  const { id: goalId } = await params;
  const input = await body<Record<string, unknown>>(request);

  const goal = await get<{ id: string }>(
    `SELECT id FROM savings_goals WHERE id = ? AND user_id = ?`,
    goalId,
    user.id,
  );
  if (!goal) return fail("Goal not found.", 404);

  const amount = Math.round(num(input.amount) * 100) / 100;
  if (amount === 0) return fail("Enter an amount.");

  const id = uid("gc_");
  await run(
    `INSERT INTO goal_contributions (id, goal_id, user_id, amount, date, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    id,
    goalId,
    user.id,
    amount,
    dateStr(input.date, today()),
    str(input.note),
    nowIso(),
  );

  return json({ id }, 201);
});
