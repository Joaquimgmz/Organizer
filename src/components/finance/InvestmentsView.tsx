"use client";

import {
  ArrowDownToLine,
  CalendarClock,
  ChevronDown,
  Coins,
  LineChart as LineChartIcon,
  Pencil,
  Percent,
  Plus,
  Repeat,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { LineChart } from "@/components/charts/Charts";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, StatTile } from "@/components/ui/Card";
import { Callout, EmptyState, Skeleton } from "@/components/ui/Feedback";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { ConfirmDialog, Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { api, useApi } from "@/lib/client";
import { investmentStats, monthlyEquivalent } from "@/lib/finance";
import type { TranslationKey } from "@/lib/i18n";
import {
  FREQUENCIES,
  type Frequency,
  type Investment,
  type InvestmentIncome,
} from "@/lib/types";
import {
  addMonths,
  cn,
  formatDate,
  formatMoney,
  formatShortDate,
  relativeDay,
  today,
} from "@/lib/utils";

type Draft = {
  id?: string;
  title: string;
  down_payment: string;
  contribution_amount: string;
  frequency: Frequency;
  start_date: string;
  notes: string;
};

function emptyDraft(): Draft {
  return {
    title: "",
    down_payment: "",
    contribution_amount: "",
    frequency: "monthly",
    start_date: today(),
    notes: "",
  };
}

/** In-progress "log a payout" form, tied to the investment it belongs to. */
type IncomeDraft = {
  investment: Investment;
  amount: string;
  date: string;
  note: string;
};

/**
 * Translated period names, replacing the English-only FREQUENCY_LABEL from
 * finance.ts. That constant stays there for any non-UI caller; the interface
 * goes through these keys so the label follows the selected language.
 */
const FREQUENCY_KEY: Record<Frequency, TranslationKey> = {
  daily: "frequency.day",
  weekly: "frequency.week",
  monthly: "frequency.month",
};

const SERIES = [
  "var(--series-1)",
  "var(--series-2)",
  "var(--series-3)",
  "var(--series-4)",
  "var(--series-5)",
  "var(--series-6)",
  "var(--series-7)",
  "var(--series-8)",
];

/**
 * Recurring investment plans: a down payment plus a fixed amount every
 * day / week / month.
 *
 * Everything shown is money contributed, never a projected return — the app
 * has no idea what any of these actually earn, and inventing a growth rate
 * would be making up numbers about someone's money.
 */
export function InvestmentsView({ currency }: { currency: string }) {
  const { push } = useToast();
  const { t, locale } = useLanguage();
  const { data, loading, error, reload } = useApi<{ investments: Investment[] }>(
    "/api/finance/investments",
  );

  const [draft, setDraft] = useState<Draft | null>(null);
  const [income, setIncome] = useState<IncomeDraft | null>(null);
  const [deleting, setDeleting] = useState<Investment | null>(null);
  /** Which card has its full income history expanded, if any. */
  const [expanded, setExpanded] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const investments = data?.investments ?? [];
  const rows = investments.map((investment) => ({
    investment,
    ...investmentStats(investment),
  }));

  const totalContributed = rows.reduce((sum, row) => sum + row.contributed, 0);
  const totalDownPayments = rows.reduce(
    (sum, row) => sum + row.investment.down_payment,
    0,
  );
  const monthlyCommitment = rows.reduce((sum, row) => sum + row.perMonth, 0);

  // ── Income totals across every plan ────────────────────────────────────────
  const totalIncome = rows.reduce((sum, row) => sum + row.incomeTotal, 0);
  const incomeEntryCount = rows.reduce((sum, row) => sum + row.incomeCount, 0);
  /** Realised return across the portfolio. Null while nothing has gone in. */
  const overallReturn =
    totalContributed > 0 ? (totalIncome / totalContributed) * 100 : null;
  /** Positive once income has overtaken everything contributed. */
  const netPosition = totalIncome - totalContributed;

  /** Total contributed month by month, 24 months out, if the plans continue. */
  const projection = useMemo(() => {
    if (rows.length === 0) return [];
    return Array.from({ length: 25 }, (_, month) => ({
      label: formatDate(
        addMonths(today(), month),
        { month: "short", year: "2-digit" },
        locale,
      ),
      total: Math.round(totalContributed + monthlyCommitment * month),
    }));
    // `locale` is a dependency because the axis labels are formatted with it.
  }, [rows.length, totalContributed, monthlyCommitment, locale]);

  async function save() {
    if (!draft) return;

    if (!draft.title.trim()) {
      push(t("investments.needTitle"), "error");
      return;
    }
    const down = Number(draft.down_payment) || 0;
    const contribution = Number(draft.contribution_amount) || 0;
    if (down <= 0 && contribution <= 0) {
      push(t("investments.needAnAmount"), "error");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: draft.title,
        down_payment: down,
        contribution_amount: contribution,
        frequency: draft.frequency,
        start_date: draft.start_date,
        notes: draft.notes,
      };

      if (draft.id) {
        await api.patch(`/api/finance/investments/${draft.id}`, payload);
        push(t("investments.updated"));
      } else {
        await api.post("/api/finance/investments", payload);
        push(t("investments.added"));
      }
      setDraft(null);
      await reload();
    } catch (caught) {
      push(
        caught instanceof Error ? caught.message : t("common.couldntSave"),
        "error",
      );
    } finally {
      setSaving(false);
    }
  }

  async function remove(investment: Investment) {
    try {
      await api.delete(`/api/finance/investments/${investment.id}`);
      push(t("investments.deleted"));
      await reload();
    } catch {
      push(t("investments.couldntDelete"), "error");
    }
  }

  /** Record a payout received from one investment. */
  async function logIncome() {
    if (!income) return;

    const amount = Number(income.amount);
    if (!Number.isFinite(amount) || amount === 0) {
      push(t("common.enterAmount"), "error");
      return;
    }

    setSaving(true);
    try {
      await api.post(`/api/finance/investments/${income.investment.id}/income`, {
        amount,
        date: income.date,
        note: income.note,
      });
      push(
        t("investments.incomeRecorded", {
          amount: formatMoney(amount, currency, locale),
          title: income.investment.title,
        }),
      );
      setIncome(null);
      await reload();
    } catch (caught) {
      push(
        caught instanceof Error ? caught.message : t("common.couldntSave"),
        "error",
      );
    } finally {
      setSaving(false);
    }
  }

  /** Drop one payout from the history; the totals recalculate from what's left. */
  async function removeIncome(entry: InvestmentIncome) {
    try {
      await api.delete(`/api/finance/income/${entry.id}`);
      await reload();
    } catch {
      push(t("investments.couldntRemoveEntry"), "error");
    }
  }

  if (loading && !data) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  // Live preview of what the form's numbers mean.
  const previewMonthly =
    draft && Number(draft.contribution_amount) > 0
      ? monthlyEquivalent(Number(draft.contribution_amount), draft.frequency)
      : 0;

  return (
    <>
      {error && (
        <Callout tone="danger" className="mb-4">
          {error}
        </Callout>
      )}

      {investments.length > 0 && (
        <div className="stagger mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <StatTile
            label={t("investments.totalPutIn")}
            value={formatMoney(totalContributed, currency, locale)}
            hint={t("investments.upFrontHint", {
              amount: formatMoney(totalDownPayments, currency, locale),
            })}
            icon={<TrendingUp className="size-4" />}
            accent="var(--series-1)"
          />
          {/* Money out, from logged payouts only — never a projection. */}
          <StatTile
            label={t("investments.totalIncome")}
            value={formatMoney(totalIncome, currency, locale)}
            hint={
              incomeEntryCount > 0
                ? incomeEntryCount === 1
                  ? t("investments.fromOnePayout")
                  : t("investments.fromPayouts", { count: incomeEntryCount })
                : t("investments.nothingRecorded")
            }
            icon={<Coins className="size-4" />}
            accent="var(--series-2)"
          />
          {/* The relationship between the two: income as a share of money in,
              plus how far off breaking even the portfolio still is. */}
          <StatTile
            label={t("investments.returnSoFar")}
            value={overallReturn === null ? "—" : `${overallReturn.toFixed(1)}%`}
            delta={
              totalIncome > 0
                ? `${netPosition >= 0 ? "+" : "−"}${formatMoney(
                    Math.abs(netPosition),
                    currency,
                    locale,
                  )}`
                : undefined
            }
            deltaGood={netPosition >= 0}
            hint={
              totalIncome > 0
                ? netPosition >= 0
                  ? t("investments.incomeVsMoneyIn")
                  : t("investments.stillToRecover")
                : t("investments.logToSee")
            }
            icon={<Percent className="size-4" />}
            accent="var(--series-4)"
          />
          <StatTile
            label={t("investments.everyMonth")}
            value={formatMoney(monthlyCommitment, currency, locale)}
            hint={t("investments.everyMonthHint")}
            icon={<Repeat className="size-4" />}
            accent="var(--series-3)"
          />
          <StatTile
            label={t("investments.plansRunning")}
            value={investments.length}
            hint={
              rows.length > 0
                ? t("investments.oldestSince", {
                    date: formatDate(
                      [...investments].sort((a, b) =>
                        a.start_date.localeCompare(b.start_date),
                      )[0].start_date,
                      { month: "short", year: "numeric" },
                      locale,
                    ),
                  })
                : undefined
            }
            icon={<LineChartIcon className="size-4" />}
            accent="var(--series-7)"
          />
          <StatTile
            label={t("investments.inTwelveMonths")}
            value={formatMoney(
              totalContributed + monthlyCommitment * 12,
              currency,
              locale,
            )}
            hint={t("investments.contributionsOnly")}
            icon={<CalendarClock className="size-4" />}
            accent="var(--series-6)"
          />
        </div>
      )}

      <div className="mb-4 flex justify-end">
        <Button variant="primary" size="sm" onClick={() => setDraft(emptyDraft())}>
          <Plus className="size-4" />
          {t("investments.add")}
        </Button>
      </div>

      {investments.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              icon={<TrendingUp className="size-5" />}
              title={t("investments.emptyTitle")}
              message={t("investments.emptyMessage")}
              action={
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setDraft(emptyDraft())}
                >
                  <Plus className="size-4" />
                  {t("investments.add")}
                </Button>
              }
            />
          </CardBody>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[1fr_22rem]">
          <div className="stagger grid min-w-0 gap-4 lg:grid-cols-2 xl:grid-cols-1">
            {rows.map(
              (
                {
                  investment,
                  contributed,
                  contributionsMade,
                  perMonth,
                  nextDate,
                  projected,
                  incomeTotal,
                  incomeCount,
                  returnPercent,
                  net,
                  incomePerMonth,
                },
                index,
              ) => (
                <Card key={investment.id}>
                  <CardHeader
                    title={investment.title}
                    icon={
                      <span
                        aria-hidden
                        className="block size-2.5 rounded-[3px]"
                        style={{ background: SERIES[index % SERIES.length] }}
                      />
                    }
                    subtitle={t("investments.startedOn", {
                      date: formatDate(
                        investment.start_date,
                        { month: "short", day: "numeric", year: "numeric" },
                        locale,
                      ),
                    })}
                    action={
                      <>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t("investments.editAria")}
                          onClick={() =>
                            setDraft({
                              id: investment.id,
                              title: investment.title,
                              down_payment: String(investment.down_payment),
                              contribution_amount: String(
                                investment.contribution_amount,
                              ),
                              frequency: investment.frequency,
                              start_date: investment.start_date,
                              notes: investment.notes,
                            })
                          }
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t("investments.deleteAria")}
                          onClick={() => setDeleting(investment)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </>
                    }
                  />
                  <CardBody>
                    {/* The recurring amount lives here rather than in the header:
                        as a header action it couldn't shrink, and pushed the card
                        wider than a phone screen. */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-ink text-2xl leading-none font-semibold tracking-tight">
                          {formatMoney(contributed, currency, locale)}
                        </p>
                        <p className="text-ink-3 mt-1 text-[12.5px]">
                          {t("investments.putInSoFar")}
                        </p>
                      </div>
                      {investment.contribution_amount > 0 && (
                        <Badge
                          color="var(--series-7)"
                          className="h-6 px-2 text-[12px]"
                        >
                          <Repeat className="size-3" />
                          {formatMoney(
                            investment.contribution_amount,
                            currency,
                            locale,
                          )}
                          {" / "}
                          {t(FREQUENCY_KEY[investment.frequency])}
                        </Badge>
                      )}
                    </div>

                    <dl className="border-line mt-4 grid gap-3 border-t pt-3 sm:grid-cols-2 lg:grid-cols-4">
                      <div>
                        <dt className="text-ink-3 flex items-center gap-1 text-[11.5px]">
                          <ArrowDownToLine className="size-3" />
                          {t("investments.downPayment")}
                        </dt>
                        <dd className="text-ink mt-0.5 text-[14px] font-medium tabular-nums">
                          {formatMoney(investment.down_payment, currency, locale)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-ink-3 text-[11.5px]">
                          {t("investments.contributionsMade")}
                        </dt>
                        <dd className="text-ink mt-0.5 text-[14px] font-medium tabular-nums">
                          {contributionsMade.toLocaleString(locale)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-ink-3 text-[11.5px]">
                          {t("investments.perMonthEquivalent")}
                        </dt>
                        <dd className="text-ink mt-0.5 text-[14px] font-medium tabular-nums">
                          {formatMoney(perMonth, currency, locale)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-ink-3 text-[11.5px]">
                          {t("investments.nextContribution")}
                        </dt>
                        <dd className="text-ink mt-0.5 text-[14px] font-medium">
                          {relativeDay(nextDate, locale, {
                            today: t("date.today"),
                            tomorrow: t("date.tomorrow"),
                            yesterday: t("date.yesterday"),
                          })}
                        </dd>
                      </div>
                    </dl>

                    {/* ── Income ────────────────────────────────────────────
                        Payouts actually received from this plan, and what they
                        amount to against the money put in. Everything here is
                        derived from logged entries — no return rate is assumed. */}
                    <div className="border-line mt-3 border-t pt-3">
                      <div className="flex flex-wrap items-end justify-between gap-2">
                        <div>
                          <p className="text-ink-3 flex items-center gap-1 text-[11.5px]">
                            <Coins className="size-3" />
                            {t("investments.incomeReceived")}
                          </p>
                          <p className="text-ink mt-0.5 text-lg leading-none font-semibold tabular-nums">
                            {formatMoney(incomeTotal, currency, locale)}
                          </p>
                        </div>

                        {incomeTotal > 0 && (
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px]">
                            {returnPercent !== null && (
                              <span className="text-ink-3">
                                {t("investments.returnLabel")}{" "}
                                <span className="text-ink font-medium tabular-nums">
                                  {returnPercent.toFixed(1)}%
                                </span>
                              </span>
                            )}
                            {incomePerMonth !== null && (
                              <span className="text-ink-3">
                                {t("investments.perMonthLabel")}{" "}
                                <span className="text-ink font-medium tabular-nums">
                                  {formatMoney(incomePerMonth, currency, locale)}
                                </span>
                              </span>
                            )}
                            <span className="text-ink-3">
                              {t("investments.netLabel")}{" "}
                              <span
                                className="font-medium tabular-nums"
                                style={{
                                  color:
                                    net >= 0
                                      ? "var(--good-ink)"
                                      : "var(--ink-2)",
                                }}
                              >
                                {net >= 0 ? "+" : "−"}
                                {formatMoney(Math.abs(net), currency, locale)}
                              </span>
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Payout history. Newest first from the API; only the
                          three most recent show until the card is expanded. */}
                      {incomeCount > 0 && (
                        <>
                          <ul className="mt-2 space-y-0.5">
                            {(expanded === investment.id
                              ? investment.income
                              : investment.income.slice(0, 3)
                            ).map((entry) => (
                              <li
                                key={entry.id}
                                className="group hover:bg-surface-2 flex items-center gap-2 rounded-md px-1.5 py-1 text-[12.5px] transition-colors"
                              >
                                <span className="text-ink-3 w-[4.5rem] shrink-0 tabular-nums">
                                  {formatShortDate(entry.date, locale)}
                                </span>
                                <span className="text-ink shrink-0 font-medium tabular-nums">
                                  {formatMoney(entry.amount, currency, locale)}
                                </span>
                                {entry.note && (
                                  <span className="text-ink-3 truncate">
                                    {entry.note}
                                  </span>
                                )}
                                <button
                                  onClick={() => removeIncome(entry)}
                                  className="text-ink-3 hover:text-critical ml-auto shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                                  aria-label={t("investments.removeIncomeAria")}
                                >
                                  <Trash2 className="size-3.5" />
                                </button>
                              </li>
                            ))}
                          </ul>

                          {incomeCount > 3 && (
                            <button
                              onClick={() =>
                                setExpanded(
                                  expanded === investment.id ? null : investment.id,
                                )
                              }
                              className="text-accent mt-1.5 flex items-center gap-1 px-1.5 text-[12px] font-medium hover:underline"
                            >
                              <ChevronDown
                                className={cn(
                                  "size-3.5 transition-transform",
                                  expanded === investment.id && "rotate-180",
                                )}
                              />
                              {expanded === investment.id
                                ? t("common.showFewer")
                                : t("common.showAll", { count: incomeCount })}
                            </button>
                          )}
                        </>
                      )}

                      <Button
                        variant="secondary"
                        size="sm"
                        className="mt-2.5 w-full"
                        onClick={() =>
                          setIncome({
                            investment,
                            amount: "",
                            date: today(),
                            note: "",
                          })
                        }
                      >
                        <Plus className="size-3.5" />
                        {t("investments.logIncome")}
                      </Button>
                    </div>

                    <div className="border-line mt-3 flex flex-wrap gap-x-5 gap-y-1 border-t pt-3 text-[12.5px]">
                      <span className="text-ink-3">
                        {t("investments.inAYear")}{" "}
                        <span className="text-ink font-medium tabular-nums">
                          {formatMoney(projected(12), currency, locale)}
                        </span>
                      </span>
                      <span className="text-ink-3">
                        {t("investments.inFive")}{" "}
                        <span className="text-ink font-medium tabular-nums">
                          {formatMoney(projected(60), currency, locale)}
                        </span>
                      </span>
                    </div>

                    {investment.notes && (
                      <p className="text-ink-3 mt-3 text-[12.5px] leading-relaxed">
                        {investment.notes}
                      </p>
                    )}
                  </CardBody>
                </Card>
              ),
            )}
          </div>

          <div className="min-w-0 space-y-4">
            <Card>
              <CardHeader
                title={t("investments.chartTitle")}
                subtitle={t("investments.chartSubtitle")}
              />
              <CardBody>
                <LineChart
                  data={projection}
                  xKey="label"
                  height={200}
                  yDomain="auto"
                  series={[
                    {
                      key: "total",
                      label: t("investments.chartSeries"),
                      color: "var(--series-1)",
                    },
                  ]}
                  formatValue={(value) => formatMoney(value, currency, locale)}
                />
                {/* Reworded now that income is tracked: the projection is still
                    contributions only, but the app no longer claims to know
                    nothing about returns — it knows exactly what you logged. */}
                <Callout tone="info" className="mt-3">
                  {t("investments.chartNote")}
                </Callout>
              </CardBody>
            </Card>

            <Card>
              <CardHeader title={t("investments.monthlyCommitment")} />
              <CardBody>
                <ul className="space-y-2">
                  {rows
                    .filter((row) => row.perMonth > 0)
                    .sort((a, b) => b.perMonth - a.perMonth)
                    .map((row, index) => (
                      <li
                        key={row.investment.id}
                        className="flex items-center gap-2 text-[12.5px]"
                      >
                        <span
                          aria-hidden
                          className="size-2 shrink-0 rounded-[2px]"
                          style={{ background: SERIES[index % SERIES.length] }}
                        />
                        <span className="text-ink-2 min-w-0 truncate">
                          {row.investment.title}
                        </span>
                        <span className="text-ink ml-auto shrink-0 font-medium tabular-nums">
                          {formatMoney(row.perMonth, currency, locale)}
                        </span>
                      </li>
                    ))}
                </ul>
                <div className="border-line mt-3 flex items-center justify-between border-t pt-3 text-[13px]">
                  <span className="text-ink-2">{t("common.total")}</span>
                  <span className="text-ink font-semibold tabular-nums">
                    {formatMoney(monthlyCommitment, currency, locale)}
                  </span>
                </div>
              </CardBody>
            </Card>

            {/* Income against money in, per plan — the clearest place to see
                which investments are actually paying out and which aren't. */}
            <Card>
              <CardHeader
                title={t("investments.incomeByInvestment")}
                subtitle={t("investments.incomeByInvestmentSubtitle")}
              />
              <CardBody>
                {totalIncome === 0 ? (
                  <p className="text-ink-3 text-[12.5px] leading-relaxed">
                    {t("investments.noIncomeYet")}
                  </p>
                ) : (
                  <>
                    <ul className="space-y-2">
                      {rows
                        .filter((row) => row.incomeTotal > 0)
                        .sort((a, b) => b.incomeTotal - a.incomeTotal)
                        .map((row, index) => (
                          <li key={row.investment.id} className="text-[12.5px]">
                            <div className="flex items-center gap-2">
                              <span
                                aria-hidden
                                className="size-2 shrink-0 rounded-[2px]"
                                style={{
                                  background: SERIES[index % SERIES.length],
                                }}
                              />
                              <span className="text-ink-2 min-w-0 truncate">
                                {row.investment.title}
                              </span>
                              <span className="text-ink ml-auto shrink-0 font-medium tabular-nums">
                                {formatMoney(row.incomeTotal, currency, locale)}
                              </span>
                            </div>
                            {row.returnPercent !== null && (
                              <p className="text-ink-3 mt-0.5 pl-4 text-[11.5px] tabular-nums">
                                {t("investments.shareOfPutIn", {
                                  percent: row.returnPercent.toFixed(1),
                                  amount: formatMoney(
                                    row.contributed,
                                    currency,
                                    locale,
                                  ),
                                })}
                              </p>
                            )}
                          </li>
                        ))}
                    </ul>
                    <div className="border-line mt-3 space-y-1 border-t pt-3 text-[13px]">
                      <div className="flex items-center justify-between">
                        <span className="text-ink-2">
                          {t("investments.totalIncome")}
                        </span>
                        <span className="text-ink font-semibold tabular-nums">
                          {formatMoney(totalIncome, currency, locale)}
                        </span>
                      </div>
                      {overallReturn !== null && (
                        <div className="flex items-center justify-between">
                          <span className="text-ink-3 text-[12.5px]">
                            {t("investments.againstIn", {
                              amount: formatMoney(
                                totalContributed,
                                currency,
                                locale,
                              ),
                            })}
                          </span>
                          <span className="text-ink-2 text-[12.5px] font-medium tabular-nums">
                            {overallReturn.toFixed(1)}%
                          </span>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </CardBody>
            </Card>
          </div>
        </div>
      )}

      {/* New / edit investment */}
      <Modal
        open={draft !== null}
        onClose={() => setDraft(null)}
        title={draft?.id ? t("investments.edit") : t("investments.add")}
        description={t("investments.addDescription")}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDraft(null)}>
              {t("common.cancel")}
            </Button>
            <Button variant="primary" onClick={save} loading={saving}>
              {draft?.id ? t("investments.saveChanges") : t("investments.add")}
            </Button>
          </>
        }
      >
        {draft && (
          <div className="space-y-4">
            <Input
              label={t("investments.titleLabel")}
              value={draft.title}
              onChange={(event) =>
                setDraft({ ...draft, title: event.target.value })
              }
              placeholder={t("investments.titlePlaceholder")}
              autoFocus
            />

            <Input
              label={t("investments.downPaymentLabel", { currency })}
              hint={t("investments.downPaymentHint")}
              type="number"
              min={0}
              step="0.01"
              value={draft.down_payment}
              onChange={(event) =>
                setDraft({ ...draft, down_payment: event.target.value })
              }
              placeholder="2000"
            />

            <div className="grid grid-cols-2 gap-3">
              <Input
                label={t("investments.recurringLabel", { currency })}
                type="number"
                min={0}
                step="0.01"
                value={draft.contribution_amount}
                onChange={(event) =>
                  setDraft({ ...draft, contribution_amount: event.target.value })
                }
                placeholder="350"
              />
              <Select
                label={t("investments.howOften")}
                value={draft.frequency}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    frequency: event.target.value as Frequency,
                  })
                }
              >
                {FREQUENCIES.map((frequency) => (
                  <option key={frequency} value={frequency}>
                    {t("investments.everyPeriod", {
                      period: t(FREQUENCY_KEY[frequency]),
                    })}
                  </option>
                ))}
              </Select>
            </div>

            <Input
              label={t("investments.startDate")}
              hint={t("investments.startDateHint")}
              type="date"
              value={draft.start_date}
              onChange={(event) =>
                setDraft({ ...draft, start_date: event.target.value })
              }
            />

            <Textarea
              label={t("investments.notesLabel")}
              hint={t("common.optional")}
              rows={2}
              value={draft.notes}
              onChange={(event) =>
                setDraft({ ...draft, notes: event.target.value })
              }
              placeholder={t("investments.notesPlaceholder")}
            />

            {previewMonthly > 0 && (
              <Callout tone="info">
                {t("investments.monthlyPreview", {
                  amount: formatMoney(
                    Number(draft.contribution_amount),
                    currency,
                    locale,
                  ),
                  period: t(FREQUENCY_KEY[draft.frequency]),
                  perMonth: formatMoney(previewMonthly, currency, locale),
                  perYear: formatMoney(previewMonthly * 12, currency, locale),
                })}
              </Callout>
            )}
          </div>
        )}
      </Modal>

      {/* Log income */}
      <Modal
        open={income !== null}
        onClose={() => setIncome(null)}
        title={
          income
            ? t("investments.logIncomeTitle", { title: income.investment.title })
            : ""
        }
        description={t("investments.logIncomeDescription")}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIncome(null)}>
              {t("common.cancel")}
            </Button>
            <Button variant="primary" onClick={logIncome} loading={saving}>
              {t("investments.logIncome")}
            </Button>
          </>
        }
      >
        {income && (
          <div className="space-y-4">
            <Input
              label={t("investments.amountLabel", { currency })}
              hint={t("investments.negativeCorrects")}
              type="number"
              step="0.01"
              value={income.amount}
              onChange={(event) =>
                setIncome({ ...income, amount: event.target.value })
              }
              placeholder="42.50"
              autoFocus
            />

            <Input
              label={t("investments.dateReceived")}
              type="date"
              value={income.date}
              onChange={(event) =>
                setIncome({ ...income, date: event.target.value })
              }
            />

            <Input
              label={t("investments.noteLabel")}
              hint={t("common.optional")}
              value={income.note}
              onChange={(event) =>
                setIncome({ ...income, note: event.target.value })
              }
              placeholder={t("investments.notePlaceholder")}
            />

            {/* Shows the effect on the realised return before it's saved. */}
            {Number(income.amount) > 0 &&
              (() => {
                const stats = investmentStats(income.investment);
                const nextTotal = stats.incomeTotal + Number(income.amount);
                return (
                  <Callout tone="info">
                    {t("investments.incomePreview", {
                      amount: formatMoney(nextTotal, currency, locale),
                    })}
                    {stats.contributed > 0 && (
                      <>
                        {" "}
                        {t("investments.incomePreviewShare", {
                          percent: (
                            (nextTotal / stats.contributed) *
                            100
                          ).toFixed(1),
                          contributed: formatMoney(
                            stats.contributed,
                            currency,
                            locale,
                          ),
                        })}
                      </>
                    )}
                  </Callout>
                );
              })()}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && remove(deleting)}
        title={t("investments.deleteTitle")}
        message={
          <>
            <strong className="text-ink">{deleting?.title}</strong>{" "}
            {/* Three phrasings rather than string concatenation: the sentence
                structure around the count differs per language. */}
            {(deleting?.income.length ?? 0) === 0
              ? t("investments.deletePlain")
              : deleting?.income.length === 1
                ? t("investments.deleteWithOneIncome")
                : t("investments.deleteWithIncome", {
                    count: deleting?.income.length ?? 0,
                  })}
          </>
        }
      />
    </>
  );
}
