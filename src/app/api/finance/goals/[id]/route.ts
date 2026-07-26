import { body, dateStr, fail, json, num, str, withUser } from "@/lib/api";
import { applyUpdates, deleteRow, pick } from "@/lib/crud";
import { today } from "@/lib/utils";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = withUser<Ctx>(async (user, request, { params }) => {
  const { id } = await params;
  const input = await body<Record<string, unknown>>(request);

  const updates = pick(input, {
    title: (value) => str(value),
    target_amount: (value) =>
      Math.round(Math.max(0, num(value)) * 100) / 100,
    notes: (value) => str(value),
    // An empty string clears the deadline.
    target_date: (value) =>
      typeof value === "string" && value ? dateStr(value, today()) : null,
  });

  if ("title" in updates && !updates.title) {
    return fail("Name what you're saving for.");
  }
  if ("target_amount" in updates && Number(updates.target_amount) <= 0) {
    return fail("Set a target amount greater than zero.");
  }

  if (applyUpdates("savings_goals", id, user.id, updates) === 0) {
    return fail("Goal not found.", 404);
  }
  return json({ ok: true });
});

export const DELETE = withUser<Ctx>(async (user, _request, { params }) => {
  const { id } = await params;
  // goal_contributions cascades.
  if (deleteRow("savings_goals", id, user.id) === 0) {
    return fail("Goal not found.", 404);
  }
  return json({ ok: true });
});
