import type { Frequency, Investment, SavingsGoal } from "./types";
import {
  addDays,
  addMonths,
  daysInMonth,
  fromDateKey,
  sum,
  toDateKey,
  today,
} from "./utils";

/**
 * Finance maths, with no database access.
 *
 * Kept free of any `./db` import on purpose: the goal and investment views are
 * client components, and pulling `node:sqlite` into their bundle breaks the
 * build. Queries live in `finance-server.ts`.
 */

// ── Recurring contribution maths ─────────────────────────────────────────────

/** Average months in a period, used to compare frequencies on one scale. */
const PER_MONTH: Record<Frequency, number> = {
  daily: 365 / 12, // 30.4167
  weekly: 52 / 12, // 4.3333
  monthly: 1,
};

export const FREQUENCY_LABEL: Record<Frequency, string> = {
  daily: "day",
  weekly: "week",
  monthly: "month",
};

/** What a per-day/week/month contribution works out to per month. */
export function monthlyEquivalent(amount: number, frequency: Frequency): number {
  return amount * PER_MONTH[frequency];
}

/**
 * How many contributions have fallen due between `start` and `asOf`, counting
 * the one on the start date itself.
 *
 * Monthly steps by calendar month rather than by 30 days, so a contribution on
 * the 31st still lands once in February.
 */
export function contributionsDue(
  start: string,
  frequency: Frequency,
  asOf = today(),
): number {
  if (asOf < start) return 0;

  if (frequency === "monthly") {
    const from = fromDateKey(start);
    const to = fromDateKey(asOf);
    const months =
      (to.getFullYear() - from.getFullYear()) * 12 +
      (to.getMonth() - from.getMonth());
    // The current month only counts once its day-of-month has arrived.
    const dayReached = to.getDate() >= Math.min(from.getDate(), daysInMonth(asOf));
    return Math.max(0, months + (dayReached ? 1 : 0));
  }

  const days = Math.floor(
    (fromDateKey(asOf).getTime() - fromDateKey(start).getTime()) / 86_400_000,
  );
  return frequency === "daily"
    ? days + 1
    : Math.floor(days / 7) + 1;
}

/** The date the next contribution falls due. */
export function nextContributionDate(
  start: string,
  frequency: Frequency,
  asOf = today(),
): string {
  if (asOf < start) return start;

  const due = contributionsDue(start, frequency, asOf);
  if (frequency === "monthly") return addMonths(start, due);
  return addDays(start, due * (frequency === "weekly" ? 7 : 1));
}

// ── Investments ──────────────────────────────────────────────────────────────

export type InvestmentStats = {
  /** Down payment plus every contribution due so far. */
  contributed: number;
  contributionsMade: number;
  perMonth: number;
  nextDate: string;
  /** Total contributed if the plan is kept up. No return rate is assumed. */
  projected: (months: number) => number;

  // ── Income (money out) ─────────────────────────────────────────────────────
  // Every figure below is derived from payouts the user actually logged.
  // Nothing here extrapolates a return rate.

  /** Sum of every logged payout. */
  incomeTotal: number;
  /** How many payouts have been logged. */
  incomeCount: number;
  /**
   * Income as a percentage of the money actually put in — the realised return
   * so far, not an annualised or forecast one. `null` when nothing has been
   * contributed yet, because a percentage of zero is meaningless rather than
   * infinite.
   */
  returnPercent: number | null;
  /** Income minus contributions: ahead when positive, still down when negative. */
  net: number;
  /**
   * Observed income per month, measured from the first payout to `asOf`.
   * `null` until something has actually been received.
   */
  incomePerMonth: number | null;
};

export function investmentStats(
  investment: Investment,
  asOf = today(),
): InvestmentStats {
  const contributionsMade = contributionsDue(
    investment.start_date,
    investment.frequency,
    asOf,
  );
  const contributed =
    investment.down_payment + contributionsMade * investment.contribution_amount;
  const perMonth = monthlyEquivalent(
    investment.contribution_amount,
    investment.frequency,
  );

  // ── Income ────────────────────────────────────────────────────────────────
  // `income` is always supplied by the API, but default to an empty list so a
  // partially-built object (a test, a future caller) can't throw here.
  const payouts = investment.income ?? [];
  const incomeTotal = sum(payouts.map((row) => row.amount));

  // A percentage is only meaningful once money has gone in.
  const returnPercent = contributed > 0 ? (incomeTotal / contributed) * 100 : null;

  // Observed rate, from the earliest payout to now. Counts the first month
  // itself (hence + 1), matching how goalStats measures its saving rate.
  let incomePerMonth: number | null = null;
  if (payouts.length > 0) {
    const first = payouts.map((row) => row.date).sort().at(0)!;
    const from = fromDateKey(first);
    const to = fromDateKey(asOf);
    const elapsedMonths = Math.max(
      1,
      (to.getFullYear() - from.getFullYear()) * 12 +
        (to.getMonth() - from.getMonth()) +
        1,
    );
    incomePerMonth = incomeTotal / elapsedMonths;
  }

  return {
    contributed,
    contributionsMade,
    perMonth,
    nextDate: nextContributionDate(
      investment.start_date,
      investment.frequency,
      asOf,
    ),
    projected: (months) => contributed + perMonth * months,
    incomeTotal,
    incomeCount: payouts.length,
    returnPercent,
    net: incomeTotal - contributed,
    incomePerMonth,
  };
}

// ── Goals ────────────────────────────────────────────────────────────────────

export type GoalStats = {
  saved: number;
  remaining: number
  percent: number;
  achieved: boolean;
  /** Months until the target date, when one is set. */
  monthsLeft: number | null;
  /** What you'd need to put aside monthly to hit the target date. */
  requiredPerMonth: number | null;
  /** Observed saving rate per month, from the contribution history. */
  ratePerMonth: number | null;
  /** Projected completion date at the observed rate. */
  projectedDate: string | null;
};

export function goalStats(goal: SavingsGoal, asOf = today()): GoalStats {
  const saved = sum(goal.contributions.map((row) => row.amount));
  const remaining = Math.max(0, goal.target_amount - saved);
  const percent =
    goal.target_amount > 0
      ? Math.min(100, (saved / goal.target_amount) * 100)
      : 0;

  let monthsLeft: number | null = null;
  let requiredPerMonth: number | null = null;

  if (goal.target_date) {
    const from = fromDateKey(asOf);
    const to = fromDateKey(goal.target_date);
    monthsLeft = Math.max(
      0,
      (to.getFullYear() - from.getFullYear()) * 12 +
        (to.getMonth() - from.getMonth()),
    );
    requiredPerMonth = remaining / Math.max(1, monthsLeft);
  }

  // Saving rate from the first contribution to now.
  let ratePerMonth: number | null = null;
  let projectedDate: string | null = null;

  if (goal.contributions.length > 0 && saved > 0) {
    const first = goal.contributions
      .map((row) => row.date)
      .sort()
      .at(0)!;
    const from = fromDateKey(first);
    const elapsedMonths = Math.max(
      1,
      (fromDateKey(asOf).getFullYear() - from.getFullYear()) * 12 +
        (fromDateKey(asOf).getMonth() - from.getMonth()) +
        1,
    );
    ratePerMonth = saved / elapsedMonths;

    if (remaining > 0 && ratePerMonth > 0) {
      const monthsNeeded = Math.ceil(remaining / ratePerMonth);
      projectedDate = toDateKey(
        fromDateKey(addMonths(asOf, Math.min(600, monthsNeeded))),
      );
    }
  }

  return {
    saved,
    remaining,
    percent,
    achieved: remaining === 0 && goal.target_amount > 0,
    monthsLeft,
    requiredPerMonth,
    ratePerMonth,
    projectedDate,
  };
}
