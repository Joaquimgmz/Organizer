import {
  body,
  dateStr,
  fail,
  json,
  num,
  oneOf,
  query,
  str,
  withUser,
} from "@/lib/api";
import { all, run as dbRun, transaction } from "@/lib/db";
import { EXPENSE_CATEGORIES, type Expense } from "@/lib/types";
import { endOfMonth, nowIso, startOfMonth, today, uid } from "@/lib/utils";

export const GET = withUser(async (user, request) => {
  const params = query(request);
  const month = dateStr(params.get("month"), today());
  const from = dateStr(params.get("from"), startOfMonth(month));
  const to = dateStr(params.get("to"), endOfMonth(month));

  const expenses = await all<Expense>(
    `SELECT * FROM expenses WHERE user_id = ? AND date BETWEEN ? AND ?
      ORDER BY date DESC, created_at DESC`,
    user.id,
    from,
    to,
  );

  const byCategory = await all<{ category: string; total: number }>(
    `SELECT category, SUM(amount) AS total FROM expenses
      WHERE user_id = ? AND date BETWEEN ? AND ?
      GROUP BY category ORDER BY total DESC`,
    user.id,
    from,
    to,
  );

  const byDay = await all<{ date: string; total: number }>(
    `SELECT date, SUM(amount) AS total FROM expenses
      WHERE user_id = ? AND date BETWEEN ? AND ?
      GROUP BY date ORDER BY date`,
    user.id,
    from,
    to,
  );

  return json({ expenses, byCategory, byDay, from, to });
});

type Incoming = {
  date?: unknown;
  description?: unknown;
  category?: unknown;
  amount?: unknown;
};

/** `run` defaults to the top-level connection; pass a transaction-scoped one for batches. */
async function insert(
  userId: string,
  input: Incoming,
  run: typeof dbRun = dbRun,
): Promise<string> {
  const id = uid("e_");
  await run(
    `INSERT INTO expenses (id, user_id, date, description, category, amount, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    id,
    userId,
    dateStr(input.date, today()),
    str(input.description) || "Expense",
    oneOf(input.category, EXPENSE_CATEGORIES, "other"),
    Math.round(Math.max(0, num(input.amount)) * 100) / 100,
    nowIso(),
  );
  return id;
}

/**
 * Accepts a single expense, or `{ expenses: [...] }` to insert several in one
 * transaction — useful for importing a batch without a partial write.
 */
export const POST = withUser(async (user, request) => {
  const input = await body<Incoming & { expenses?: Incoming[] }>(request);

  if (Array.isArray(input.expenses)) {
    const rows = input.expenses.filter((row) => num(row.amount) > 0);
    if (rows.length === 0) return fail("No valid expenses in that batch.");

    const ids = await transaction(async ({ run }) => {
      const inserted: string[] = [];
      for (const row of rows) {
        inserted.push(await insert(user.id, row, run));
      }
      return inserted;
    });
    return json({ ids, count: ids.length }, 201);
  }

  if (num(input.amount) <= 0) return fail("Enter an amount greater than zero.");
  return json({ id: await insert(user.id, input) }, 201);
});
