import { body, dateStr, fail, json, num, oneOf, str, withUser } from "@/lib/api";
import { applyUpdates, deleteRow, pick } from "@/lib/crud";
import { FREQUENCIES } from "@/lib/types";
import { today } from "@/lib/utils";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = withUser<Ctx>(async (user, request, { params }) => {
  const { id } = await params;
  const input = await body<Record<string, unknown>>(request);

  const updates = pick(input, {
    title: (value) => str(value),
    down_payment: (value) => Math.round(Math.max(0, num(value)) * 100) / 100,
    contribution_amount: (value) =>
      Math.round(Math.max(0, num(value)) * 100) / 100,
    frequency: (value) => oneOf(value, FREQUENCIES, "monthly"),
    start_date: (value) => dateStr(value, today()),
    notes: (value) => str(value),
  });

  if ("title" in updates && !updates.title) {
    return fail("Give the investment a title.");
  }

  if (applyUpdates("investments", id, user.id, updates) === 0) {
    return fail("Investment not found.", 404);
  }
  return json({ ok: true });
});

export const DELETE = withUser<Ctx>(async (user, _request, { params }) => {
  const { id } = await params;
  if (deleteRow("investments", id, user.id) === 0) {
    return fail("Investment not found.", 404);
  }
  return json({ ok: true });
});
