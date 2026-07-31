import { body, dateStr, fail, json, num, str, withUser } from "@/lib/api";
import { get, run } from "@/lib/db";
import { nowIso, today, uid } from "@/lib/utils";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Record income received from an investment — a dividend, interest, rent.
 *
 * Negative amounts are allowed on purpose, the same way goal contributions
 * permit them: it's how you correct a figure that was entered too high without
 * having to delete and retype the whole history.
 */
export const POST = withUser<Ctx>(async (user, request, { params }) => {
  const { id: investmentId } = await params;
  const input = await body<Record<string, unknown>>(request);

  // Scoped by user_id, so a request for someone else's investment gets a 404
  // rather than silently attaching income to a row the caller can't see.
  const investment = await get<{ id: string }>(
    `SELECT id FROM investments WHERE id = ? AND user_id = ?`,
    investmentId,
    user.id,
  );
  if (!investment) return fail("Investment not found.", 404);

  const amount = Math.round(num(input.amount) * 100) / 100;
  if (amount === 0) return fail("Enter an amount.");

  const id = uid("ii_");
  await run(
    `INSERT INTO investment_income (id, investment_id, user_id, amount, date, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    id,
    investmentId,
    user.id,
    amount,
    dateStr(input.date, today()),
    str(input.note),
    nowIso(),
  );

  return json({ id }, 201);
});
