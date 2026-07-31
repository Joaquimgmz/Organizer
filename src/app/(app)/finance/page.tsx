"use client";

import {
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Pencil,
  PiggyBank,
  Plus,
  Receipt,
  Settings2,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { BarList } from "@/components/charts/BarList";
import { LineChart } from "@/components/charts/Charts";
import { GoalsView } from "@/components/finance/GoalsView";
import { InvestmentsView } from "@/components/finance/InvestmentsView";
import { Page } from "@/components/layout/Shell";
import { EXPENSE_COLORS, ExpenseCategoryBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, StatTile } from "@/components/ui/Card";
import { Callout, EmptyState, Skeleton } from "@/components/ui/Feedback";
import { Input, Segmented, Select } from "@/components/ui/Field";
import { ConfirmDialog, Modal } from "@/components/ui/Modal";
import { Progress } from "@/components/ui/Progress";
import { useToast } from "@/components/ui/Toast";
import { api, useApi } from "@/lib/client";
import {
  EXPENSE_CATEGORIES,
  type Expense,
  type ExpenseCategory,
  type FinanceSettings,
} from "@/lib/types";
import {
  addMonths,
  clamp,
  daysInMonth,
  formatMoney,
  formatShortDate,
  monthLabel,
  startOfMonth,
  today,
} from "@/lib/utils";

type ExpenseDraft = {
  id?: string;
  date: string;
  description: string;
  category: ExpenseCategory;
  amount: string;
};

function emptyExpense(): ExpenseDraft {
  return {
    date: today(),
    description: "",
    category: "food",
    amount: "",
  };
}

type Tab = "overview" | "goals" | "investments";

export default function FinancePage() {
  const { push } = useToast();
  const { t, tv, locale } = useLanguage();
  const [tab, setTab] = useState<Tab>("overview");
  const [month, setMonth] = useState(startOfMonth(today()));
  const [draft, setDraft] = useState<ExpenseDraft | null>(null);
  const [deleting, setDeleting] = useState<Expense | null>(null);
  const [editingSettings, setEditingSettings] = useState(false);
  const [saving, setSaving] = useState(false);

  const settingsQuery = useApi<{ settings: FinanceSettings }>(
    "/api/finance/settings",
  );
  const expensesQuery = useApi<{
    expenses: Expense[];
    byCategory: { category: string; total: number }[];
    byDay: { date: string; total: number }[];
  }>(`/api/finance/expenses?month=${month}`);

  const settings = settingsQuery.data?.settings;
  const expenses = expensesQuery.data?.expenses ?? [];
  const byCategory = expensesQuery.data?.byCategory ?? [];
  const byDay = expensesQuery.data?.byDay ?? [];
  const currency = settings?.currency ?? "USD";

  const [form, setForm] = useState<FinanceSettings | null>(null);

  const spent = expenses.reduce((acc, expense) => acc + expense.amount, 0);
  const income = settings?.monthly_income ?? 0;
  const limit = settings?.monthly_limit || income;
  const remaining = limit - spent;
  const savingsGoal = settings?.savings_goal ?? 0;

  const isCurrentMonth = month === startOfMonth(today());
  const totalDays = daysInMonth(month);
  const dayOfMonth = isCurrentMonth ? Number(today().slice(8, 10)) : totalDays;
  const daysLeft = Math.max(1, totalDays - dayOfMonth + 1);

  // Planning: what's actually available per period from here on.
  const plan = useMemo(() => {
    const spendable = Math.max(0, income - savingsGoal);
    return {
      perMonth: spendable,
      perWeek: spendable / 4.345,
      perDay: spendable / totalDays,
      remainingPerDay: remaining / daysLeft,
      remainingPerWeek: (remaining / daysLeft) * 7,
    };
  }, [income, savingsGoal, totalDays, remaining, daysLeft]);

  // Cumulative spend against the straight-line "on pace" reference.
  const cumulative = useMemo(() => {
    const totals = new Map(byDay.map((row) => [row.date, row.total]));
    const rows: { day: number; label: string; spent: number; pace: number }[] = [];
    let running = 0;

    for (let day = 1; day <= totalDays; day += 1) {
      const key = `${month.slice(0, 8)}${String(day).padStart(2, "0")}`;
      running += totals.get(key) ?? 0;

      // Don't draw the actual line into the future.
      if (isCurrentMonth && day > dayOfMonth) {
        rows.push({
          day,
          label: formatShortDate(key, locale),
          spent: Number.NaN,
          pace: limit * (day / totalDays),
        });
      } else {
        rows.push({
          day,
          label: formatShortDate(key, locale),
          spent: Math.round(running * 100) / 100,
          pace: limit * (day / totalDays),
        });
      }
    }
    return rows;
  }, [byDay, month, totalDays, isCurrentMonth, dayOfMonth, limit, locale]);

  const categoryRows = byCategory.map((row) => ({
    ...row,
    // Stored category value → translated label; the value itself is untouched.
    label: tv("expense", row.category),
    color: EXPENSE_COLORS[row.category as ExpenseCategory] ?? "var(--ink-3)",
  }));

  const budgetUsed = limit > 0 ? (spent / limit) * 100 : 0;
  const overBudget = remaining < 0;

  async function saveSettings() {
    if (!form) return;
    setSaving(true);
    try {
      await api.put("/api/finance/settings", form);
      push(t("finance.settingsSaved"));
      setEditingSettings(false);
      await settingsQuery.reload();
    } catch (caught) {
      push(
        caught instanceof Error ? caught.message : t("common.couldntSave"),
        "error",
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveExpense() {
    if (!draft) return;
    const amount = Number(draft.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      push(t("finance.needAmount"), "error");
      return;
    }

    setSaving(true);
    try {
      const payload = { ...draft, amount };
      if (draft.id) {
        await api.patch(`/api/finance/expenses/${draft.id}`, payload);
        push(t("finance.expenseUpdated"));
      } else {
        await api.post("/api/finance/expenses", payload);
        push(t("finance.expenseAdded"));
      }
      setDraft(null);
      await expensesQuery.reload();
    } catch (caught) {
      push(
        caught instanceof Error ? caught.message : t("common.couldntSave"),
        "error",
      );
    } finally {
      setSaving(false);
    }
  }

  async function removeExpense(expense: Expense) {
    try {
      await api.delete(`/api/finance/expenses/${expense.id}`);
      push(t("finance.expenseDeleted"));
      await expensesQuery.reload();
    } catch {
      push(t("finance.couldntDeleteExpense"), "error");
    }
  }

  const loading = settingsQuery.loading && !settings;

  return (
    <Page
      title={t("nav.finance")}
      subtitle={
        tab === "overview"
          ? monthLabel(month, locale)
          : tab === "goals"
            ? t("finance.goalsSubtitle")
            : t("finance.investmentsSubtitle")
      }
      actions={
        <>
          <Segmented
            value={tab}
            onChange={setTab}
            size="sm"
            options={[
              {
                value: "overview",
                label: (
                  <span className="flex items-center gap-1.5">
                    <Wallet className="size-3.5" />
                    {t("finance.tabOverview")}
                  </span>
                ),
              },
              {
                value: "goals",
                label: (
                  <span className="flex items-center gap-1.5">
                    <Target className="size-3.5" />
                    {t("finance.tabGoals")}
                  </span>
                ),
              },
              {
                value: "investments",
                label: (
                  <span className="flex items-center gap-1.5">
                    <TrendingUp className="size-3.5" />
                    {t("finance.tabInvestments")}
                  </span>
                ),
              },
            ]}
          />

          {tab === "overview" && (
            <>
              <div className="border-line bg-surface flex items-center rounded-lg border">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setMonth(addMonths(month, -1))}
                  aria-label={t("finance.prevMonth")}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <span className="text-ink w-[8.5rem] px-1 text-center text-[13px]">
                  {monthLabel(month, locale)}
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setMonth(addMonths(month, 1))}
                  aria-label={t("finance.nextMonth")}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>

              <Button
                variant="primary"
                size="sm"
                onClick={() => setDraft(emptyExpense())}
              >
                <Plus className="size-4" />
                {t("finance.addExpense")}
              </Button>
            </>
          )}
        </>
      }
    >
      {(settingsQuery.error || expensesQuery.error) && (
        <Callout tone="danger" className="mb-4">
          {settingsQuery.error ?? expensesQuery.error}
        </Callout>
      )}

      {tab === "goals" && <GoalsView currency={currency} />}
      {tab === "investments" && <InvestmentsView currency={currency} />}

      {tab === "overview" &&
        (loading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-28" />
            ))}
          </div>
        ) : (
          <>
          {/* Headline numbers */}
          <div className="stagger mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              label={t("finance.monthlyIncome")}
              value={formatMoney(income, currency, locale)}
              hint={
                income === 0
                  ? t("finance.notSetYet")
                  : t("finance.salaryAndOther")
              }
              icon={<CircleDollarSign className="size-4" />}
              accent="var(--series-6)"
            />
            <StatTile
              label={t("finance.totalExpenses")}
              value={formatMoney(spent, currency, locale)}
              hint={
                expenses.length === 1
                  ? t("finance.oneEntryThisMonth")
                  : t("finance.entriesThisMonth", { count: expenses.length })
              }
              icon={<Receipt className="size-4" />}
              accent="var(--series-2)"
            />
            <StatTile
              label={t("finance.remainingBalance")}
              value={formatMoney(remaining, currency, locale)}
              delta={overBudget ? t("finance.overLimit") : undefined}
              deltaGood={overBudget ? false : undefined}
              hint={
                overBudget
                  ? undefined
                  : t("finance.ofLimit", {
                      amount: formatMoney(limit, currency, locale),
                    })
              }
              icon={<Wallet className="size-4" />}
              accent={overBudget ? "var(--critical)" : "var(--series-1)"}
            />
            <StatTile
              label={t("finance.safePerDay")}
              value={formatMoney(
                Math.max(0, plan.remainingPerDay),
                currency,
                locale,
              )}
              hint={
                daysLeft === 1
                  ? t("finance.oneDayLeft")
                  : t("finance.daysLeft", { count: daysLeft })
              }
              icon={<TrendingDown className="size-4" />}
              accent="var(--series-3)"
            />
          </div>

          {/* min-w-0 on the grid children: without it, a grid item sizes to
              min-content and the tables' min-width escapes their own
              overflow-x-auto container, scrolling the whole page sideways. */}
          <div className="grid gap-4 xl:grid-cols-[1fr_21rem]">
            <div className="min-w-0 space-y-4">
              {/* Budget meter */}
              <Card>
                <CardHeader
                  title={t("finance.monthlyBudget")}
                  icon={<Wallet className="size-4" />}
                  subtitle={
                    limit > 0
                      ? t("finance.spentOf", {
                          spent: formatMoney(spent, currency, locale),
                          limit: formatMoney(limit, currency, locale),
                        })
                      : t("finance.setIncomeFirst")
                  }
                  action={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t("finance.editBudgetAria")}
                      onClick={() => {
                        setForm(
                          settings ?? {
                            monthly_income: 0,
                            monthly_limit: 0,
                            savings_goal: 0,
                            currency: "USD",
                          },
                        );
                        setEditingSettings(true);
                      }}
                    >
                      <Settings2 className="size-4" />
                    </Button>
                  }
                />
                <CardBody className="space-y-4">
                  <div>
                    <Progress
                      value={clamp(budgetUsed, 0, 100)}
                      height={10}
                      color={
                        overBudget
                          ? "var(--critical)"
                          : budgetUsed > 80
                            ? "var(--warning)"
                            : "var(--good)"
                      }
                      label={t("finance.budgetUsed")}
                    />
                    <div className="text-ink-3 mt-1.5 flex justify-between text-[12px]">
                      <span>
                        {t("finance.percentUsed", {
                          percent: Math.round(budgetUsed),
                        })}
                      </span>
                      <span>
                        {overBudget
                          ? t("finance.amountOver", {
                              amount: formatMoney(-remaining, currency, locale),
                            })
                          : t("finance.amountLeft", {
                              amount: formatMoney(remaining, currency, locale),
                            })}
                      </span>
                    </div>
                  </div>

                  {/* Planning */}
                  <div className="border-line grid gap-3 border-t pt-4 sm:grid-cols-3">
                    {[
                      {
                        label: t("finance.planPerMonth"),
                        value: plan.perMonth,
                        note:
                          savingsGoal > 0
                            ? t("finance.afterSaved", {
                                amount: formatMoney(
                                  savingsGoal,
                                  currency,
                                  locale,
                                ),
                              })
                            : t("finance.incomeNothingAside"),
                      },
                      {
                        label: t("finance.planPerWeek"),
                        value: plan.perWeek,
                        note: t("finance.steadyPace"),
                      },
                      {
                        label: t("finance.planPerDay"),
                        value: plan.perDay,
                        note: t("finance.acrossDays", { count: totalDays }),
                      },
                    ].map((row) => (
                      <div key={row.label}>
                        <p className="text-ink-3 text-[12px]">{row.label}</p>
                        <p className="text-ink mt-0.5 text-[17px] font-semibold tabular-nums">
                          {formatMoney(row.value, currency, locale)}
                        </p>
                        <p className="text-ink-3 text-[11.5px]">{row.note}</p>
                      </div>
                    ))}
                  </div>
                </CardBody>
              </Card>

              {/* Spending pace */}
              <Card>
                <CardHeader
                  title={t("finance.spendingPace")}
                  subtitle={t("finance.spendingPaceSubtitle")}
                />
                <CardBody>
                  {byDay.length === 0 ? (
                    <p className="text-ink-3 py-6 text-center text-[13px]">
                      {t("finance.noExpensesFor", {
                        month: monthLabel(month, locale),
                      })}
                    </p>
                  ) : (
                    <LineChart
                      data={cumulative}
                      xKey="label"
                      height={224}
                      series={[
                        {
                          key: "spent",
                          label: t("finance.actualSpend"),
                          color: "var(--series-1)",
                        },
                        {
                          key: "pace",
                          label: t("finance.onPace"),
                          color: "var(--axis)",
                          reference: true,
                        },
                      ]}
                      formatValue={(value) => formatMoney(value, currency, locale)}
                    />
                  )}
                </CardBody>
              </Card>

              {/* Expense table */}
              <Card>
                <CardHeader
                  title={t("finance.expenses")}
                  icon={<Receipt className="size-4" />}
                  subtitle={
                    expenses.length === 1
                      ? t("finance.oneEntryIn", {
                          month: monthLabel(month, locale),
                        })
                      : t("finance.entriesIn", {
                          count: expenses.length,
                          month: monthLabel(month, locale),
                        })
                  }
                  action={
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setDraft(emptyExpense())}
                    >
                      <Plus className="size-3.5" />
                      {t("common.add")}
                    </Button>
                  }
                />
                <CardBody>
                  {expensesQuery.loading && !expensesQuery.data ? (
                    <Skeleton className="h-64" />
                  ) : expenses.length === 0 ? (
                    <EmptyState
                      icon={<Receipt className="size-5" />}
                      title={t("finance.noExpensesTitle")}
                      message={t("finance.noExpensesMessage")}
                      action={
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => setDraft(emptyExpense())}
                        >
                          <Plus className="size-4" />
                          {t("finance.addExpense")}
                        </Button>
                      }
                    />
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[34rem] border-collapse text-left">
                        <thead>
                          <tr className="border-line border-b">
                            {/* Alignment is a flag rather than a comparison
                                against the label text, which stops working once
                                the label is translated. */}
                            {[
                              { id: "date", label: t("finance.colDate") },
                              {
                                id: "description",
                                label: t("finance.colDescription"),
                              },
                              { id: "category", label: t("finance.colCategory") },
                              {
                                id: "amount",
                                label: t("finance.colAmount"),
                                right: true,
                              },
                              { id: "actions", label: "" },
                            ].map((heading) => (
                              <th
                                key={heading.id}
                                className={
                                  "text-ink-3 py-2 pr-3 text-[11.5px] font-medium " +
                                  (heading.right ? "text-right" : "")
                                }
                              >
                                {heading.label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {expenses.map((expense) => (
                            <tr
                              key={expense.id}
                              className="border-line group border-b last:border-b-0"
                            >
                              <td className="text-ink-3 py-2 pr-3 text-[12.5px] whitespace-nowrap tabular-nums">
                                {formatShortDate(expense.date, locale)}
                              </td>
                              <td className="text-ink py-2 pr-3 text-[13px]">
                                {expense.description}
                              </td>
                              <td className="py-2 pr-3">
                                <ExpenseCategoryBadge category={expense.category} />
                              </td>
                              <td className="text-ink py-2 pr-3 text-right text-[13px] font-medium tabular-nums">
                                {formatMoney(expense.amount, currency, locale)}
                              </td>
                              <td className="py-2">
                                <div className="flex justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    aria-label={t("common.edit")}
                                    onClick={() =>
                                      setDraft({
                                        id: expense.id,
                                        date: expense.date,
                                        description: expense.description,
                                        category: expense.category,
                                        amount: String(expense.amount),
                                      })
                                    }
                                  >
                                    <Pencil className="size-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    aria-label={t("common.delete")}
                                    onClick={() => setDeleting(expense)}
                                  >
                                    <Trash2 className="size-3.5" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr>
                            <td colSpan={3} className="text-ink-2 py-2.5 text-[13px]">
                              {t("common.total")}
                            </td>
                            <td className="text-ink py-2.5 pr-3 text-right text-[13.5px] font-semibold tabular-nums">
                              {formatMoney(spent, currency, locale)}
                            </td>
                            <td />
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </CardBody>
              </Card>
            </div>

            {/* Right column */}
            <div className="min-w-0 space-y-4">
              <Card>
                <CardHeader
                  title={t("finance.spendingByCategory")}
                  subtitle={
                    categoryRows.length > 0
                      ? t("finance.largest", { category: categoryRows[0].label })
                      : undefined
                  }
                />
                <CardBody>
                  {categoryRows.length === 0 ? (
                    <p className="text-ink-3 text-[13px]">
                      {t("finance.nothingToChart")}
                    </p>
                  ) : (
                    <BarList
                      rows={categoryRows.map((row) => ({
                        key: row.category,
                        label: row.label,
                        value: row.total,
                        color: row.color,
                      }))}
                      format={(value) => formatMoney(value, currency, locale)}
                    />
                  )}
                </CardBody>
              </Card>

              {savingsGoal > 0 && (
                <Card>
                  <CardHeader
                    title={t("finance.monthlySavings")}
                    icon={<PiggyBank className="size-4" />}
                    subtitle={t("finance.savingsTarget", {
                      amount: formatMoney(savingsGoal, currency, locale),
                    })}
                  />
                  <CardBody>
                    {(() => {
                      const saved =
                        byCategory.find((row) => row.category === "savings")
                          ?.total ?? 0;
                      return (
                        <>
                          <Progress
                            value={saved}
                            max={savingsGoal}
                            color="var(--series-6)"
                            height={10}
                            label={t("finance.savingsProgress")}
                          />
                          <p className="text-ink-3 mt-2 text-[12.5px]">
                            {t("finance.savedLogged", {
                              amount: formatMoney(saved, currency, locale),
                            })}
                            {saved < savingsGoal &&
                              ` ${t("finance.toGo", {
                                amount: formatMoney(
                                  savingsGoal - saved,
                                  currency,
                                  locale,
                                ),
                              })}`}
                            . {t("finance.forPurchaseUse")}{" "}
                            <button
                              onClick={() => setTab("goals")}
                              className="text-accent font-medium hover:underline"
                            >
                              {t("finance.tabGoals")}
                            </button>
                            .
                          </p>
                        </>
                      );
                    })()}
                  </CardBody>
                </Card>
              )}
            </div>
          </div>
          </>
        ))}

      {/* Budget settings */}
      <Modal
        open={editingSettings}
        onClose={() => setEditingSettings(false)}
        title={t("finance.budgetSettings")}
        description={t("finance.budgetSettingsDesc")}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditingSettings(false)}>
              {t("common.cancel")}
            </Button>
            <Button variant="primary" onClick={saveSettings} loading={saving}>
              {t("finance.saveSettings")}
            </Button>
          </>
        }
      >
        {form && (
          <div className="space-y-4">
            <Input
              label={t("finance.monthlyIncome")}
              hint={t("finance.incomeHint")}
              type="number"
              min={0}
              step="0.01"
              value={form.monthly_income || ""}
              onChange={(event) =>
                setForm({ ...form, monthly_income: Number(event.target.value) })
              }
              placeholder="3200"
            />
            <Input
              label={t("finance.limitLabel")}
              hint={t("finance.limitHint")}
              type="number"
              min={0}
              step="0.01"
              value={form.monthly_limit || ""}
              onChange={(event) =>
                setForm({ ...form, monthly_limit: Number(event.target.value) })
              }
              placeholder="2400"
            />
            <Input
              label={t("finance.savingsGoalLabel")}
              type="number"
              min={0}
              step="0.01"
              value={form.savings_goal || ""}
              onChange={(event) =>
                setForm({ ...form, savings_goal: Number(event.target.value) })
              }
              placeholder="500"
            />
            <Select
              label={t("finance.currency")}
              value={form.currency}
              onChange={(event) =>
                setForm({ ...form, currency: event.target.value })
              }
            >
              {["USD", "EUR", "GBP", "BRL", "CAD", "AUD", "JPY", "INR", "CHF"].map(
                (code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ),
              )}
            </Select>
          </div>
        )}
      </Modal>

      {/* Add / edit expense */}
      <Modal
        open={draft !== null}
        onClose={() => setDraft(null)}
        title={draft?.id ? t("finance.editExpense") : t("finance.addExpense")}
        footer={
          <>
            {draft?.id && (
              <Button
                variant="ghost"
                className="mr-auto"
                onClick={() => {
                  const target = expenses.find((item) => item.id === draft.id);
                  setDraft(null);
                  if (target) setDeleting(target);
                }}
              >
                <Trash2 className="size-4" />
                {t("common.delete")}
              </Button>
            )}
            <Button variant="ghost" onClick={() => setDraft(null)}>
              {t("common.cancel")}
            </Button>
            <Button variant="primary" onClick={saveExpense} loading={saving}>
              {draft?.id ? t("common.saveChanges") : t("finance.addExpense")}
            </Button>
          </>
        }
      >
        {draft && (
          <div className="space-y-4">
            <Input
              label={t("finance.colDescription")}
              value={draft.description}
              onChange={(event) =>
                setDraft({ ...draft, description: event.target.value })
              }
              placeholder={t("finance.descriptionPlaceholder")}
              autoFocus
            />

            <div className="grid grid-cols-2 gap-3">
              <Input
                label={t("investments.amountLabel", { currency })}
                type="number"
                min={0}
                step="0.01"
                value={draft.amount}
                onChange={(event) =>
                  setDraft({ ...draft, amount: event.target.value })
                }
                placeholder="0.00"
              />
              <Input
                label={t("finance.colDate")}
                type="date"
                value={draft.date}
                onChange={(event) =>
                  setDraft({ ...draft, date: event.target.value })
                }
              />
            </div>

            <Select
              label={t("finance.colCategory")}
              value={draft.category}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  category: event.target.value as ExpenseCategory,
                })
              }
            >
              {EXPENSE_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {tv("expense", category)}
                </option>
              ))}
            </Select>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && removeExpense(deleting)}
        title={t("finance.deleteExpenseTitle")}
        message={
          <>
            <strong className="text-ink">{deleting?.description}</strong> (
            {deleting ? formatMoney(deleting.amount, currency, locale) : ""}){" "}
            {t("finance.willBeRemoved")}
          </>
        }
      />
    </Page>
  );
}
