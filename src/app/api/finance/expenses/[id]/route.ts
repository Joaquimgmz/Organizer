import { body, dateStr, fail, json, num, oneOf, str, withUser } from "@/lib/api";
import { applyUpdates, deleteRow, pick } from "@/lib/crud";
import { EXPENSE_CATEGORIES } from "@/lib/types";
import { today } from "@/lib/utils";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = withUser<Ctx>(async (user, request, { params }) => {
  const { id } = await params;
  const input = await body<Record<string, unknown>>(request);

  const updates = pick(input, {
    description: (v) => str(v) || "Expense",
    category: (v) => oneOf(v, EXPENSE_CATEGORIES, "other"),
    date: (v) => dateStr(v, today()),
    amount: (v) => Math.round(Math.max(0, num(v)) * 100) / 100,
  });

  if (updates.amount === 0) return fail("Enter an amount greater than zero.");

  const changed = await applyUpdates("expenses", id, user.id, updates);
  if (changed === 0) return fail("Expense not found.", 404);

  return json({ ok: true });
});

export const DELETE = withUser<Ctx>(async (user, _request, { params }) => {
  const { id } = await params;
  if ((await deleteRow("expenses", id, user.id)) === 0) {
    return fail("Expense not found.", 404);
  }
  return json({ ok: true });
});
