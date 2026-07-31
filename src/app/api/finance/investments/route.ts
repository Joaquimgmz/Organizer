import {
  body,
  dateStr,
  fail,
  json,
  num,
  oneOf,
  str,
  withUser,
} from "@/lib/api";
import { all, run } from "@/lib/db";
import {
  FREQUENCIES,
  type Investment,
  type InvestmentIncome,
} from "@/lib/types";
import { nowIso, today, uid } from "@/lib/utils";

type InvestmentRow = Omit<Investment, "income">;

/**
 * Investments with their income history attached in one extra query.
 *
 * Same two-query shape as loadGoals: one row set per table, grouped in memory,
 * so adding income costs a single round trip rather than one per investment.
 */
export async function loadInvestments(userId: string): Promise<Investment[]> {
  const investments = await all<InvestmentRow>(
    `SELECT id, title, down_payment, contribution_amount, frequency, start_date, notes, created_at
       FROM investments WHERE user_id = ? ORDER BY created_at DESC`,
    userId,
  );
  if (investments.length === 0) return [];

  const placeholders = investments.map(() => "?").join(", ");
  const income = await all<InvestmentIncome>(
    `SELECT id, investment_id, amount, date, note, created_at
       FROM investment_income
      WHERE user_id = ? AND investment_id IN (${placeholders})
      ORDER BY date DESC, created_at DESC`,
    userId,
    ...investments.map((investment) => investment.id),
  );

  const grouped = new Map<string, InvestmentIncome[]>();
  for (const row of income) {
    if (!grouped.has(row.investment_id)) grouped.set(row.investment_id, []);
    grouped.get(row.investment_id)!.push(row);
  }

  return investments.map((investment) => ({
    ...investment,
    income: grouped.get(investment.id) ?? [],
  }));
}

export const GET = withUser(async (user) =>
  json({ investments: await loadInvestments(user.id) }),
);

export const POST = withUser(async (user, request) => {
  const input = await body<Record<string, unknown>>(request);

  const title = str(input.title);
  if (!title) return fail("Give the investment a title.");

  const downPayment = Math.round(Math.max(0, num(input.down_payment)) * 100) / 100;
  const contribution =
    Math.round(Math.max(0, num(input.contribution_amount)) * 100) / 100;

  // A plan with neither an up-front amount nor a recurring one tracks nothing.
  if (downPayment === 0 && contribution === 0) {
    return fail("Enter a down payment, a recurring amount, or both.");
  }

  const id = uid("i_");
  await run(
    `INSERT INTO investments
       (id, user_id, title, down_payment, contribution_amount, frequency, start_date, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    user.id,
    title,
    downPayment,
    contribution,
    oneOf(input.frequency, FREQUENCIES, "monthly"),
    dateStr(input.start_date, today()),
    str(input.notes),
    nowIso(),
  );

  return json({ id }, 201);
});
