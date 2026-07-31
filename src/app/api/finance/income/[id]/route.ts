import { fail, json, withUser } from "@/lib/api";
import { deleteRow } from "@/lib/crud";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Remove a single payout from an investment's income history.
 *
 * Mirrors the goal-contribution delete route: deleteRow scopes by user_id, so
 * one account can't delete another's row — it gets a 404 instead.
 */
export const DELETE = withUser<Ctx>(async (user, _request, { params }) => {
  const { id } = await params;
  if ((await deleteRow("investment_income", id, user.id)) === 0) {
    return fail("Income entry not found.", 404);
  }
  return json({ ok: true });
});
