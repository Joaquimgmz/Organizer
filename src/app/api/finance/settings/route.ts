import { body, json, num, str, withUser } from "@/lib/api";
import { get, run } from "@/lib/db";
import type { FinanceSettings } from "@/lib/types";

const DEFAULTS: FinanceSettings = {
  monthly_income: 0,
  monthly_limit: 0,
  savings_goal: 0,
  currency: "USD",
};

function read(userId: string): FinanceSettings {
  return (
    get<FinanceSettings>(
      `SELECT monthly_income, monthly_limit, savings_goal, currency
         FROM finance_settings WHERE user_id = ?`,
      userId,
    ) ?? DEFAULTS
  );
}

export const GET = withUser(async (user) => json({ settings: read(user.id) }));

export const PUT = withUser(async (user, request) => {
  const input = await body<Record<string, unknown>>(request);
  const current = read(user.id);

  const settings: FinanceSettings = {
    monthly_income: Math.max(
      0,
      num(input.monthly_income, current.monthly_income),
    ),
    monthly_limit: Math.max(0, num(input.monthly_limit, current.monthly_limit)),
    savings_goal: Math.max(0, num(input.savings_goal, current.savings_goal)),
    currency:
      str(input.currency, current.currency).toUpperCase().slice(0, 3) ||
      current.currency,
  };

  run(
    `INSERT INTO finance_settings (user_id, monthly_income, monthly_limit, savings_goal, currency)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       monthly_income = excluded.monthly_income,
       monthly_limit  = excluded.monthly_limit,
       savings_goal   = excluded.savings_goal,
       currency       = excluded.currency`,
    user.id,
    settings.monthly_income,
    settings.monthly_limit,
    settings.savings_goal,
    settings.currency,
  );

  return json({ settings });
});
