import { all, get } from "./db";
import type { Expense, FinanceSettings } from "./types";
import { daysInMonth, endOfMonth, startOfMonth, sum, today } from "./utils";

/**
 * Server-only finance queries. Separate from `finance.ts` so client components
 * can import the maths without dragging `node:sqlite` into the browser bundle.
 */

export type FinanceFacts = {
  settings: FinanceSettings;
  spent: number;
  remaining: number;
  income: number;
  limit: number;
  byCategory: { category: string; total: number; share: number }[];
  dayOfMonth: number;
  totalDays: number;
  /** What "on budget" would look like today, if spending were even. */
  expectedPace: number;
  dailyLeft: number;
  weeklyLeft: number;
  expenseCount: number;
};

export async function financeFacts(
  userId: string,
  day = today(),
): Promise<FinanceFacts> {
  const settings =
    (await get<FinanceSettings>(
      `SELECT monthly_income, monthly_limit, savings_goal, currency
         FROM finance_settings WHERE user_id = ?`,
      userId,
    )) ?? {
      monthly_income: 0,
      monthly_limit: 0,
      savings_goal: 0,
      currency: "USD",
    };

  const expenses = await all<Expense>(
    `SELECT * FROM expenses WHERE user_id = ? AND date BETWEEN ? AND ?`,
    userId,
    startOfMonth(day),
    endOfMonth(day),
  );

  const spent = sum(expenses.map((expense) => expense.amount));
  const limit = settings.monthly_limit || settings.monthly_income;
  const remaining = limit - spent;

  const totals = new Map<string, number>();
  for (const expense of expenses) {
    totals.set(
      expense.category,
      (totals.get(expense.category) ?? 0) + expense.amount,
    );
  }

  const byCategory = [...totals.entries()]
    .map(([category, total]) => ({
      category,
      total,
      share: spent > 0 ? total / spent : 0,
    }))
    .sort((a, b) => b.total - a.total);

  const totalDays = daysInMonth(day);
  const dayOfMonth = Number(day.slice(8, 10));
  const daysLeft = Math.max(1, totalDays - dayOfMonth + 1);

  return {
    settings,
    spent,
    remaining,
    income: settings.monthly_income,
    limit,
    byCategory,
    dayOfMonth,
    totalDays,
    expectedPace: limit * (dayOfMonth / totalDays),
    dailyLeft: remaining / daysLeft,
    weeklyLeft: (remaining / daysLeft) * 7,
    expenseCount: expenses.length,
  };
}
