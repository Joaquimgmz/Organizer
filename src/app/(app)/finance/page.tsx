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
  titleCase,
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
          label: formatShortDate(key),
          spent: Number.NaN,
          pace: limit * (day / totalDays),
        });
      } else {
        rows.push({
          day,
          label: formatShortDate(key),
          spent: Math.round(running * 100) / 100,
          pace: limit * (day / totalDays),
        });
      }
    }
    return rows;
  }, [byDay, month, totalDays, isCurrentMonth, dayOfMonth, limit]);

  const categoryRows = byCategory.map((row) => ({
    ...row,
    label: titleCase(row.category),
    color: EXPENSE_COLORS[row.category as ExpenseCategory] ?? "var(--ink-3)",
  }));

  const budgetUsed = limit > 0 ? (spent / limit) * 100 : 0;
  const overBudget = remaining < 0;

  async function saveSettings() {
    if (!form) return;
    setSaving(true);
    try {
      await api.put("/api/finance/settings", form);
      push("Budget settings saved.");
      setEditingSettings(false);
      await settingsQuery.reload();
    } catch (caught) {
      push(caught instanceof Error ? caught.message : "Couldn't save.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function saveExpense() {
    if (!draft) return;
    const amount = Number(draft.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      push("Enter an amount greater than zero.", "error");
      return;
    }

    setSaving(true);
    try {
      const payload = { ...draft, amount };
      if (draft.id) {
        await api.patch(`/api/finance/expenses/${draft.id}`, payload);
        push("Expense updated.");
      } else {
        await api.post("/api/finance/expenses", payload);
        push("Expense added.");
      }
      setDraft(null);
      await expensesQuery.reload();
    } catch (caught) {
      push(caught instanceof Error ? caught.message : "Couldn't save.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function removeExpense(expense: Expense) {
    try {
      await api.delete(`/api/finance/expenses/${expense.id}`);
      push("Expense deleted.");
      await expensesQuery.reload();
    } catch {
      push("Couldn't delete that expense.", "error");
    }
  }

  const loading = settingsQuery.loading && !settings;

  return (
    <Page
      title="Finance"
      subtitle={
        tab === "overview"
          ? monthLabel(month)
          : tab === "goals"
            ? "Saving up for something expensive"
            : "Recurring investment plans"
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
                    Overview
                  </span>
                ),
              },
              {
                value: "goals",
                label: (
                  <span className="flex items-center gap-1.5">
                    <Target className="size-3.5" />
                    Goals
                  </span>
                ),
              },
              {
                value: "investments",
                label: (
                  <span className="flex items-center gap-1.5">
                    <TrendingUp className="size-3.5" />
                    Investments
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
                  aria-label="Previous month"
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <span className="text-ink w-[8.5rem] px-1 text-center text-[13px]">
                  {monthLabel(month)}
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setMonth(addMonths(month, 1))}
                  aria-label="Next month"
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
                Add expense
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
              label="Monthly income"
              value={formatMoney(income, currency)}
              hint={income === 0 ? "Not set yet" : "Salary and other income"}
              icon={<CircleDollarSign className="size-4" />}
              accent="var(--series-6)"
            />
            <StatTile
              label="Total expenses"
              value={formatMoney(spent, currency)}
              hint={`${expenses.length} ${expenses.length === 1 ? "entry" : "entries"} this month`}
              icon={<Receipt className="size-4" />}
              accent="var(--series-2)"
            />
            <StatTile
              label="Remaining balance"
              value={formatMoney(remaining, currency)}
              delta={overBudget ? "Over limit" : undefined}
              deltaGood={overBudget ? false : undefined}
              hint={
                overBudget
                  ? undefined
                  : `of a ${formatMoney(limit, currency)} limit`
              }
              icon={<Wallet className="size-4" />}
              accent={overBudget ? "var(--critical)" : "var(--series-1)"}
            />
            <StatTile
              label="Safe to spend per day"
              value={formatMoney(Math.max(0, plan.remainingPerDay), currency)}
              hint={`${daysLeft} ${daysLeft === 1 ? "day" : "days"} left in the month`}
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
                  title="Monthly budget"
                  icon={<Wallet className="size-4" />}
                  subtitle={
                    limit > 0
                      ? `${formatMoney(spent, currency)} spent of ${formatMoney(limit, currency)}`
                      : "Set an income and a spending limit to track this"
                  }
                  action={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Edit budget settings"
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
                      label="Budget used"
                    />
                    <div className="text-ink-3 mt-1.5 flex justify-between text-[12px]">
                      <span>{Math.round(budgetUsed)}% used</span>
                      <span>
                        {overBudget
                          ? `${formatMoney(-remaining, currency)} over`
                          : `${formatMoney(remaining, currency)} left`}
                      </span>
                    </div>
                  </div>

                  {/* Planning */}
                  <div className="border-line grid gap-3 border-t pt-4 sm:grid-cols-3">
                    {[
                      {
                        label: "Per month",
                        value: plan.perMonth,
                        note:
                          savingsGoal > 0
                            ? `after ${formatMoney(savingsGoal, currency)} saved`
                            : "income, nothing set aside",
                      },
                      {
                        label: "Per week",
                        value: plan.perWeek,
                        note: "steady pace",
                      },
                      {
                        label: "Per day",
                        value: plan.perDay,
                        note: `across ${totalDays} days`,
                      },
                    ].map((row) => (
                      <div key={row.label}>
                        <p className="text-ink-3 text-[12px]">{row.label}</p>
                        <p className="text-ink mt-0.5 text-[17px] font-semibold tabular-nums">
                          {formatMoney(row.value, currency)}
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
                  title="Spending pace"
                  subtitle="Cumulative spend against a straight line to your limit"
                />
                <CardBody>
                  {byDay.length === 0 ? (
                    <p className="text-ink-3 py-6 text-center text-[13px]">
                      No expenses recorded for {monthLabel(month)}.
                    </p>
                  ) : (
                    <LineChart
                      data={cumulative}
                      xKey="label"
                      height={224}
                      series={[
                        {
                          key: "spent",
                          label: "Actual spend",
                          color: "var(--series-1)",
                        },
                        {
                          key: "pace",
                          label: "On pace for the limit",
                          color: "var(--axis)",
                          reference: true,
                        },
                      ]}
                      formatValue={(value) => formatMoney(value, currency)}
                    />
                  )}
                </CardBody>
              </Card>

              {/* Expense table */}
              <Card>
                <CardHeader
                  title="Expenses"
                  icon={<Receipt className="size-4" />}
                  subtitle={`${expenses.length} ${expenses.length === 1 ? "entry" : "entries"} in ${monthLabel(month)}`}
                  action={
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setDraft(emptyExpense())}
                    >
                      <Plus className="size-3.5" />
                      Add
                    </Button>
                  }
                />
                <CardBody>
                  {expensesQuery.loading && !expensesQuery.data ? (
                    <Skeleton className="h-64" />
                  ) : expenses.length === 0 ? (
                    <EmptyState
                      icon={<Receipt className="size-5" />}
                      title="No expenses logged"
                      message="Log what you spend and it'll show up here, grouped by category."
                      action={
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => setDraft(emptyExpense())}
                        >
                          <Plus className="size-4" />
                          Add expense
                        </Button>
                      }
                    />
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[34rem] border-collapse text-left">
                        <thead>
                          <tr className="border-line border-b">
                            {["Date", "Description", "Category", "Amount", ""].map(
                              (heading) => (
                                <th
                                  key={heading}
                                  className={
                                    "text-ink-3 py-2 pr-3 text-[11.5px] font-medium " +
                                    (heading === "Amount" ? "text-right" : "")
                                  }
                                >
                                  {heading}
                                </th>
                              ),
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {expenses.map((expense) => (
                            <tr
                              key={expense.id}
                              className="border-line group border-b last:border-b-0"
                            >
                              <td className="text-ink-3 py-2 pr-3 text-[12.5px] whitespace-nowrap tabular-nums">
                                {formatShortDate(expense.date)}
                              </td>
                              <td className="text-ink py-2 pr-3 text-[13px]">
                                {expense.description}
                              </td>
                              <td className="py-2 pr-3">
                                <ExpenseCategoryBadge category={expense.category} />
                              </td>
                              <td className="text-ink py-2 pr-3 text-right text-[13px] font-medium tabular-nums">
                                {formatMoney(expense.amount, currency)}
                              </td>
                              <td className="py-2">
                                <div className="flex justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    aria-label="Edit"
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
                                    aria-label="Delete"
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
                              Total
                            </td>
                            <td className="text-ink py-2.5 pr-3 text-right text-[13.5px] font-semibold tabular-nums">
                              {formatMoney(spent, currency)}
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
                  title="Spending by category"
                  subtitle={
                    categoryRows.length > 0
                      ? `Largest: ${categoryRows[0].label}`
                      : undefined
                  }
                />
                <CardBody>
                  {categoryRows.length === 0 ? (
                    <p className="text-ink-3 text-[13px]">
                      Nothing to chart yet this month.
                    </p>
                  ) : (
                    <BarList
                      rows={categoryRows.map((row) => ({
                        key: row.category,
                        label: row.label,
                        value: row.total,
                        color: row.color,
                      }))}
                      format={(value) => formatMoney(value, currency)}
                    />
                  )}
                </CardBody>
              </Card>

              {savingsGoal > 0 && (
                <Card>
                  <CardHeader
                    title="Monthly savings"
                    icon={<PiggyBank className="size-4" />}
                    subtitle={`Target of ${formatMoney(savingsGoal, currency)} per month`}
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
                            label="Savings progress"
                          />
                          <p className="text-ink-3 mt-2 text-[12.5px]">
                            {formatMoney(saved, currency)} logged under the
                            savings category this month
                            {saved < savingsGoal &&
                              ` - ${formatMoney(savingsGoal - saved, currency)} to go`}
                            . For a specific purchase, use{" "}
                            <button
                              onClick={() => setTab("goals")}
                              className="text-accent font-medium hover:underline"
                            >
                              Goals
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
        title="Budget settings"
        description="Used for the spending limit and the planning figures."
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditingSettings(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={saveSettings} loading={saving}>
              Save settings
            </Button>
          </>
        }
      >
        {form && (
          <div className="space-y-4">
            <Input
              label="Monthly income"
              hint="Salary and anything else that comes in"
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
              label="Monthly spending limit"
              hint="Leave at 0 to use your income"
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
              label="Savings goal per month"
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
              label="Currency"
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
        title={draft?.id ? "Edit expense" : "Add expense"}
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
                Delete
              </Button>
            )}
            <Button variant="ghost" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={saveExpense} loading={saving}>
              {draft?.id ? "Save changes" : "Add expense"}
            </Button>
          </>
        }
      >
        {draft && (
          <div className="space-y-4">
            <Input
              label="Description"
              value={draft.description}
              onChange={(event) =>
                setDraft({ ...draft, description: event.target.value })
              }
              placeholder="Weekly groceries"
              autoFocus
            />

            <div className="grid grid-cols-2 gap-3">
              <Input
                label={`Amount (${currency})`}
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
                label="Date"
                type="date"
                value={draft.date}
                onChange={(event) =>
                  setDraft({ ...draft, date: event.target.value })
                }
              />
            </div>

            <Select
              label="Category"
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
                  {titleCase(category)}
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
        title="Delete expense?"
        message={
          <>
            <strong className="text-ink">{deleting?.description}</strong> (
            {deleting ? formatMoney(deleting.amount, currency) : ""}) will be
            removed.
          </>
        }
      />
    </Page>
  );
}
