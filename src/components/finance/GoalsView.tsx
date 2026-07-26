"use client";

import {
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Coins,
  Pencil,
  PiggyBank,
  Plus,
  Target,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, StatTile } from "@/components/ui/Card";
import { Callout, EmptyState, Skeleton } from "@/components/ui/Feedback";
import { Input, Textarea } from "@/components/ui/Field";
import { ConfirmDialog, Modal } from "@/components/ui/Modal";
import { Progress } from "@/components/ui/Progress";
import { useToast } from "@/components/ui/Toast";
import { api, useApi } from "@/lib/client";
import { goalStats } from "@/lib/finance";
import type { GoalContribution, SavingsGoal } from "@/lib/types";
import { cn, formatDate, formatMoney, formatShortDate, today } from "@/lib/utils";

type GoalDraft = {
  id?: string;
  title: string;
  target_amount: string;
  target_date: string;
  saved_amount: string;
  notes: string;
};

function emptyDraft(): GoalDraft {
  return {
    title: "",
    target_amount: "",
    target_date: "",
    saved_amount: "",
    notes: "",
  };
}

type MoneyDraft = { goal: SavingsGoal; amount: string; date: string; note: string };

/**
 * Saving up for one expensive thing — a car, a deposit, a laptop.
 *
 * Progress is the sum of dated contributions rather than a single "saved" field,
 * so the observed saving rate is real and a mistyped amount can be removed.
 */
export function GoalsView({ currency }: { currency: string }) {
  const { push } = useToast();
  const { data, loading, error, reload } = useApi<{ goals: SavingsGoal[] }>(
    "/api/finance/goals",
  );

  const [draft, setDraft] = useState<GoalDraft | null>(null);
  const [money, setMoney] = useState<MoneyDraft | null>(null);
  const [deleting, setDeleting] = useState<SavingsGoal | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const goals = data?.goals ?? [];
  const stats = goals.map((goal) => ({ goal, ...goalStats(goal) }));

  const totalTarget = stats.reduce((sum, row) => sum + row.goal.target_amount, 0);
  const totalSaved = stats.reduce((sum, row) => sum + row.saved, 0);
  const totalRemaining = Math.max(0, totalTarget - totalSaved);
  const monthlyNeeded = stats.reduce(
    (sum, row) => sum + (row.requiredPerMonth ?? 0),
    0,
  );

  async function saveGoal() {
    if (!draft) return;

    if (!draft.title.trim()) {
      push("Name what you're saving for.", "error");
      return;
    }
    if (!(Number(draft.target_amount) > 0)) {
      push("Set a target amount greater than zero.", "error");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: draft.title,
        target_amount: Number(draft.target_amount),
        target_date: draft.target_date || "",
        notes: draft.notes,
      };

      if (draft.id) {
        await api.patch(`/api/finance/goals/${draft.id}`, payload);
        push("Goal updated.");
      } else {
        await api.post("/api/finance/goals", {
          ...payload,
          saved_amount: Number(draft.saved_amount) || 0,
        });
        push("Goal created.");
      }
      setDraft(null);
      await reload();
    } catch (caught) {
      push(caught instanceof Error ? caught.message : "Couldn't save.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function addMoney() {
    if (!money) return;
    const amount = Number(money.amount);
    if (!Number.isFinite(amount) || amount === 0) {
      push("Enter an amount.", "error");
      return;
    }

    setSaving(true);
    try {
      await api.post(`/api/finance/goals/${money.goal.id}/contributions`, {
        amount,
        date: money.date,
        note: money.note,
      });
      push(`${formatMoney(amount, currency)} added to ${money.goal.title}.`);
      setMoney(null);
      await reload();
    } catch (caught) {
      push(caught instanceof Error ? caught.message : "Couldn't save.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function removeGoal(goal: SavingsGoal) {
    try {
      await api.delete(`/api/finance/goals/${goal.id}`);
      push("Goal deleted.");
      await reload();
    } catch {
      push("Couldn't delete that goal.", "error");
    }
  }

  async function removeContribution(contribution: GoalContribution) {
    try {
      await api.delete(`/api/finance/contributions/${contribution.id}`);
      await reload();
    } catch {
      push("Couldn't remove that entry.", "error");
    }
  }

  if (loading && !data) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-52" />
        <Skeleton className="h-52" />
      </div>
    );
  }

  return (
    <>
      {error && (
        <Callout tone="danger" className="mb-4">
          {error}
        </Callout>
      )}

      {goals.length > 0 && (
        <div className="stagger mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            label="Total target"
            value={formatMoney(totalTarget, currency)}
            hint={`${goals.length} ${goals.length === 1 ? "goal" : "goals"}`}
            icon={<Target className="size-4" />}
            accent="var(--series-1)"
          />
          <StatTile
            label="Saved so far"
            value={formatMoney(totalSaved, currency)}
            hint={
              totalTarget > 0
                ? `${Math.round((totalSaved / totalTarget) * 100)}% of the way there`
                : undefined
            }
            icon={<PiggyBank className="size-4" />}
            accent="var(--series-6)"
          />
          <StatTile
            label="Still needed"
            value={formatMoney(totalRemaining, currency)}
            icon={<Coins className="size-4" />}
            accent="var(--series-2)"
          />
          <StatTile
            label="Needed per month"
            value={formatMoney(monthlyNeeded, currency)}
            hint={
              monthlyNeeded > 0
                ? "to hit every dated goal"
                : "no target dates set"
            }
            icon={<CalendarClock className="size-4" />}
            accent="var(--series-3)"
          />
        </div>
      )}

      <div className="mb-4 flex justify-end">
        <Button
          variant="primary"
          size="sm"
          onClick={() => setDraft(emptyDraft())}
        >
          <Plus className="size-4" />
          New goal
        </Button>
      </div>

      {goals.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              icon={<Target className="size-5" />}
              title="No goals yet"
              message="Add something expensive you're saving towards — a car, a deposit, a trip — and track what you've put aside."
              action={
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setDraft(emptyDraft())}
                >
                  <Plus className="size-4" />
                  New goal
                </Button>
              }
            />
          </CardBody>
        </Card>
      ) : (
        <div className="stagger grid gap-4 lg:grid-cols-2">
          {stats.map(
            ({
              goal,
              saved,
              remaining,
              percent,
              achieved,
              monthsLeft,
              requiredPerMonth,
              ratePerMonth,
              projectedDate,
            }) => {
              // Behind only means something when there's a deadline to be behind.
              const behind =
                requiredPerMonth !== null &&
                ratePerMonth !== null &&
                !achieved &&
                ratePerMonth < requiredPerMonth;

              const color = achieved
                ? "var(--good)"
                : behind
                  ? "var(--warning)"
                  : "var(--accent)";

              const open = expanded === goal.id;
              const visible = open
                ? goal.contributions
                : goal.contributions.slice(0, 3);

              return (
                <Card key={goal.id} className="flex flex-col">
                  <CardHeader
                    title={goal.title}
                    icon={<Target className="size-4" />}
                    subtitle={
                      goal.target_date
                        ? `Target date ${formatDate(goal.target_date, { month: "short", day: "numeric", year: "numeric" })}`
                        : "No target date"
                    }
                    action={
                      <>
                        {achieved && (
                          <Badge color="var(--good)">
                            <CheckCircle2 className="size-3" />
                            Reached
                          </Badge>
                        )}
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Edit goal"
                          onClick={() =>
                            setDraft({
                              id: goal.id,
                              title: goal.title,
                              target_amount: String(goal.target_amount),
                              target_date: goal.target_date ?? "",
                              saved_amount: "",
                              notes: goal.notes,
                            })
                          }
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Delete goal"
                          onClick={() => setDeleting(goal)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </>
                    }
                  />

                  <CardBody className="flex flex-1 flex-col">
                    <div className="mb-1 flex items-end justify-between gap-3">
                      <p className="text-ink text-xl leading-none font-semibold tracking-tight">
                        {formatMoney(saved, currency)}
                        <span className="text-ink-3 text-[13px] font-normal">
                          {" "}
                          of {formatMoney(goal.target_amount, currency)}
                        </span>
                      </p>
                      <p className="text-ink text-[13px] font-medium tabular-nums">
                        {Math.round(percent)}%
                      </p>
                    </div>

                    <Progress
                      value={percent}
                      color={color}
                      height={10}
                      label={`${goal.title} progress`}
                    />

                    <div className="text-ink-3 mt-1.5 flex justify-between text-[12px]">
                      <span>
                        {achieved
                          ? "Fully funded"
                          : `${formatMoney(remaining, currency)} to go`}
                      </span>
                      {monthsLeft !== null && !achieved && (
                        <span>
                          {monthsLeft === 0
                            ? "due this month"
                            : `${monthsLeft} ${monthsLeft === 1 ? "month" : "months"} left`}
                        </span>
                      )}
                    </div>

                    {/* Pace */}
                    {!achieved && (
                      <div className="border-line mt-3 grid gap-3 border-t pt-3 sm:grid-cols-2">
                        {requiredPerMonth !== null && (
                          <div>
                            <p className="text-ink-3 text-[11.5px]">
                              Needed per month
                            </p>
                            <p className="text-ink mt-0.5 text-[15px] font-semibold tabular-nums">
                              {formatMoney(requiredPerMonth, currency)}
                            </p>
                          </div>
                        )}
                        {ratePerMonth !== null && (
                          <div>
                            <p className="text-ink-3 text-[11.5px]">
                              Your pace so far
                            </p>
                            <p
                              className="mt-0.5 text-[15px] font-semibold tabular-nums"
                              style={{
                                color: behind
                                  ? "var(--warning-ink)"
                                  : "var(--good-ink)",
                              }}
                            >
                              {formatMoney(ratePerMonth, currency)}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {!achieved && behind && requiredPerMonth !== null && ratePerMonth !== null && (
                      <Callout tone="warning" className="mt-3">
                        At your current pace you&apos;d be short. Adding{" "}
                        <strong className="text-ink">
                          {formatMoney(requiredPerMonth - ratePerMonth, currency)}
                        </strong>{" "}
                        more per month closes the gap.
                      </Callout>
                    )}

                    {!achieved &&
                      !goal.target_date &&
                      projectedDate !== null && (
                        <p className="text-ink-3 mt-3 flex items-center gap-1.5 text-[12.5px]">
                          <TrendingUp className="size-3.5" />
                          At this pace you&apos;ll get there around{" "}
                          {formatDate(projectedDate, {
                            month: "long",
                            year: "numeric",
                          })}
                          .
                        </p>
                      )}

                    {goal.notes && (
                      <p className="text-ink-3 mt-3 text-[12.5px] leading-relaxed">
                        {goal.notes}
                      </p>
                    )}

                    {/* Contributions */}
                    {goal.contributions.length > 0 && (
                      <div className="border-line mt-3 border-t pt-3">
                        <p className="text-ink-3 mb-1.5 text-[11.5px] font-medium">
                          Money put aside
                        </p>
                        <ul className="space-y-0.5">
                          {visible.map((contribution) => (
                            <li
                              key={contribution.id}
                              className="group hover:bg-surface-2 flex items-center gap-2 rounded-md px-1.5 py-1 text-[12.5px] transition-colors"
                            >
                              <span className="text-ink-3 w-[4.5rem] shrink-0 tabular-nums">
                                {formatShortDate(contribution.date)}
                              </span>
                              <span className="text-ink font-medium tabular-nums">
                                {formatMoney(contribution.amount, currency)}
                              </span>
                              {contribution.note && (
                                <span className="text-ink-3 truncate">
                                  {contribution.note}
                                </span>
                              )}
                              <button
                                onClick={() => removeContribution(contribution)}
                                className="text-ink-3 hover:text-critical ml-auto shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                                aria-label="Remove this entry"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </li>
                          ))}
                        </ul>

                        {goal.contributions.length > 3 && (
                          <button
                            onClick={() => setExpanded(open ? null : goal.id)}
                            className="text-accent mt-1.5 flex items-center gap-1 px-1.5 text-[12px] font-medium hover:underline"
                          >
                            <ChevronDown
                              className={cn(
                                "size-3.5 transition-transform",
                                open && "rotate-180",
                              )}
                            />
                            {open
                              ? "Show fewer"
                              : `Show all ${goal.contributions.length}`}
                          </button>
                        )}
                      </div>
                    )}

                    <Button
                      variant="secondary"
                      size="sm"
                      className="mt-4 w-full"
                      onClick={() =>
                        setMoney({
                          goal,
                          amount: "",
                          date: today(),
                          note: "",
                        })
                      }
                    >
                      <Plus className="size-3.5" />
                      Add money
                    </Button>
                  </CardBody>
                </Card>
              );
            },
          )}
        </div>
      )}

      {/* New / edit goal */}
      <Modal
        open={draft !== null}
        onClose={() => setDraft(null)}
        title={draft?.id ? "Edit goal" : "New savings goal"}
        description="Something expensive you're putting money aside for."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={saveGoal} loading={saving}>
              {draft?.id ? "Save changes" : "Create goal"}
            </Button>
          </>
        }
      >
        {draft && (
          <div className="space-y-4">
            <Input
              label="What are you saving for?"
              value={draft.title}
              onChange={(event) =>
                setDraft({ ...draft, title: event.target.value })
              }
              placeholder="Used car"
              autoFocus
            />

            <div className="grid grid-cols-2 gap-3">
              <Input
                label={`Target amount (${currency})`}
                type="number"
                min={0}
                step="0.01"
                value={draft.target_amount}
                onChange={(event) =>
                  setDraft({ ...draft, target_amount: event.target.value })
                }
                placeholder="9500"
              />
              <Input
                label="Target date"
                hint="Optional"
                type="date"
                min={today()}
                value={draft.target_date}
                onChange={(event) =>
                  setDraft({ ...draft, target_date: event.target.value })
                }
              />
            </div>

            {!draft.id && (
              <Input
                label={`Already saved (${currency})`}
                hint="Optional"
                type="number"
                min={0}
                step="0.01"
                value={draft.saved_amount}
                onChange={(event) =>
                  setDraft({ ...draft, saved_amount: event.target.value })
                }
                placeholder="0"
              />
            )}

            <Textarea
              label="Notes"
              hint="Optional"
              rows={2}
              value={draft.notes}
              onChange={(event) =>
                setDraft({ ...draft, notes: event.target.value })
              }
              placeholder="Anything worth remembering about this purchase"
            />

            {draft.target_date && Number(draft.target_amount) > 0 && (
              <Callout tone="info">
                A target date lets the app work out what you need to put aside
                each month, and flag it when your pace falls behind.
              </Callout>
            )}
          </div>
        )}
      </Modal>

      {/* Add money */}
      <Modal
        open={money !== null}
        onClose={() => setMoney(null)}
        title={money ? `Add money to ${money.goal.title}` : ""}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setMoney(null)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={addMoney} loading={saving}>
              Add money
            </Button>
          </>
        }
      >
        {money && (
          <div className="space-y-4">
            <Input
              label={`Amount (${currency})`}
              hint="A negative amount corrects a mistake"
              type="number"
              step="0.01"
              value={money.amount}
              onChange={(event) =>
                setMoney({ ...money, amount: event.target.value })
              }
              placeholder="450"
              autoFocus
            />
            <Input
              label="Date"
              type="date"
              value={money.date}
              onChange={(event) =>
                setMoney({ ...money, date: event.target.value })
              }
            />
            <Input
              label="Note"
              hint="Optional"
              value={money.note}
              onChange={(event) =>
                setMoney({ ...money, note: event.target.value })
              }
              placeholder="Monthly transfer"
            />
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && removeGoal(deleting)}
        title="Delete goal?"
        message={
          <>
            <strong className="text-ink">{deleting?.title}</strong> and its
            record of {deleting?.contributions.length ?? 0} contributions will be
            deleted. This doesn&apos;t touch your expenses.
          </>
        }
      />
    </>
  );
}
