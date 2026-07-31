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
import { useLanguage } from "@/components/LanguageProvider";
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
  const { t, locale } = useLanguage();
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
      push(t("goals.needTitle"), "error");
      return;
    }
    if (!(Number(draft.target_amount) > 0)) {
      push(t("goals.needTarget"), "error");
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
        push(t("goals.updated"));
      } else {
        await api.post("/api/finance/goals", {
          ...payload,
          saved_amount: Number(draft.saved_amount) || 0,
        });
        push(t("goals.created"));
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

  async function addMoney() {
    if (!money) return;
    const amount = Number(money.amount);
    if (!Number.isFinite(amount) || amount === 0) {
      push(t("common.enterAmount"), "error");
      return;
    }

    setSaving(true);
    try {
      await api.post(`/api/finance/goals/${money.goal.id}/contributions`, {
        amount,
        date: money.date,
        note: money.note,
      });
      push(
        t("goals.moneyAdded", {
          amount: formatMoney(amount, currency, locale),
          title: money.goal.title,
        }),
      );
      setMoney(null);
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

  async function removeGoal(goal: SavingsGoal) {
    try {
      await api.delete(`/api/finance/goals/${goal.id}`);
      push(t("goals.deleted"));
      await reload();
    } catch {
      push(t("goals.couldntDelete"), "error");
    }
  }

  async function removeContribution(contribution: GoalContribution) {
    try {
      await api.delete(`/api/finance/contributions/${contribution.id}`);
      await reload();
    } catch {
      push(t("goals.couldntRemoveEntry"), "error");
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
            label={t("goals.totalTarget")}
            value={formatMoney(totalTarget, currency, locale)}
            hint={
              goals.length === 1
                ? t("goals.oneGoal")
                : t("goals.countGoals", { count: goals.length })
            }
            icon={<Target className="size-4" />}
            accent="var(--series-1)"
          />
          <StatTile
            label={t("goals.savedSoFar")}
            value={formatMoney(totalSaved, currency, locale)}
            hint={
              totalTarget > 0
                ? t("goals.percentThere", {
                    percent: Math.round((totalSaved / totalTarget) * 100),
                  })
                : undefined
            }
            icon={<PiggyBank className="size-4" />}
            accent="var(--series-6)"
          />
          <StatTile
            label={t("goals.stillNeeded")}
            value={formatMoney(totalRemaining, currency, locale)}
            icon={<Coins className="size-4" />}
            accent="var(--series-2)"
          />
          <StatTile
            label={t("goals.neededPerMonth")}
            value={formatMoney(monthlyNeeded, currency, locale)}
            hint={
              monthlyNeeded > 0
                ? t("goals.toHitDated")
                : t("goals.noTargetDates")
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
          {t("goals.newGoal")}
        </Button>
      </div>

      {goals.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              icon={<Target className="size-5" />}
              title={t("goals.emptyTitle")}
              message={t("goals.emptyMessage")}
              action={
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setDraft(emptyDraft())}
                >
                  <Plus className="size-4" />
                  {t("goals.newGoal")}
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
                        ? t("goals.targetDate", {
                            date: formatDate(
                              goal.target_date,
                              { month: "short", day: "numeric", year: "numeric" },
                              locale,
                            ),
                          })
                        : t("goals.noTargetDate")
                    }
                    action={
                      <>
                        {achieved && (
                          <Badge color="var(--good)">
                            <CheckCircle2 className="size-3" />
                            {t("goals.reached")}
                          </Badge>
                        )}
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t("goals.editAria")}
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
                          aria-label={t("goals.deleteAria")}
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
                        {formatMoney(saved, currency, locale)}
                        <span className="text-ink-3 text-[13px] font-normal">
                          {" "}
                          {t("goals.ofTarget", {
                            amount: formatMoney(
                              goal.target_amount,
                              currency,
                              locale,
                            ),
                          })}
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
                      label={t("goals.progressLabel", { title: goal.title })}
                    />

                    <div className="text-ink-3 mt-1.5 flex justify-between text-[12px]">
                      <span>
                        {achieved
                          ? t("goals.fullyFunded")
                          : t("goals.amountToGo", {
                              amount: formatMoney(remaining, currency, locale),
                            })}
                      </span>
                      {monthsLeft !== null && !achieved && (
                        <span>
                          {monthsLeft === 0
                            ? t("goals.dueThisMonth")
                            : monthsLeft === 1
                              ? t("goals.oneMonthLeft")
                              : t("goals.monthsLeft", { count: monthsLeft })}
                        </span>
                      )}
                    </div>

                    {/* Pace */}
                    {!achieved && (
                      <div className="border-line mt-3 grid gap-3 border-t pt-3 sm:grid-cols-2">
                        {requiredPerMonth !== null && (
                          <div>
                            <p className="text-ink-3 text-[11.5px]">
                              {t("goals.neededPerMonth")}
                            </p>
                            <p className="text-ink mt-0.5 text-[15px] font-semibold tabular-nums">
                              {formatMoney(requiredPerMonth, currency, locale)}
                            </p>
                          </div>
                        )}
                        {ratePerMonth !== null && (
                          <div>
                            <p className="text-ink-3 text-[11.5px]">
                              {t("goals.yourPace")}
                            </p>
                            <p
                              className="mt-0.5 text-[15px] font-semibold tabular-nums"
                              style={{
                                color: behind
                                  ? "var(--warning-ink)"
                                  : "var(--good-ink)",
                              }}
                            >
                              {formatMoney(ratePerMonth, currency, locale)}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {!achieved && behind && requiredPerMonth !== null && ratePerMonth !== null && (
                      <Callout tone="warning" className="mt-3">
                        {t("goals.behindWarning", {
                          amount: formatMoney(
                            requiredPerMonth - ratePerMonth,
                            currency,
                            locale,
                          ),
                        })}
                      </Callout>
                    )}

                    {!achieved &&
                      !goal.target_date &&
                      projectedDate !== null && (
                        <p className="text-ink-3 mt-3 flex items-center gap-1.5 text-[12.5px]">
                          <TrendingUp className="size-3.5" />
                          {t("goals.projectedFinish", {
                            date: formatDate(
                              projectedDate,
                              { month: "long", year: "numeric" },
                              locale,
                            ),
                          })}
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
                          {t("goals.moneyPutAside")}
                        </p>
                        <ul className="space-y-0.5">
                          {visible.map((contribution) => (
                            <li
                              key={contribution.id}
                              className="group hover:bg-surface-2 flex items-center gap-2 rounded-md px-1.5 py-1 text-[12.5px] transition-colors"
                            >
                              <span className="text-ink-3 w-[4.5rem] shrink-0 tabular-nums">
                                {formatShortDate(contribution.date, locale)}
                              </span>
                              <span className="text-ink font-medium tabular-nums">
                                {formatMoney(contribution.amount, currency, locale)}
                              </span>
                              {contribution.note && (
                                <span className="text-ink-3 truncate">
                                  {contribution.note}
                                </span>
                              )}
                              <button
                                onClick={() => removeContribution(contribution)}
                                className="text-ink-3 hover:text-critical ml-auto shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                                aria-label={t("goals.removeEntryAria")}
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
                              ? t("common.showFewer")
                              : t("common.showAll", {
                                  count: goal.contributions.length,
                                })}
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
                      {t("goals.addMoney")}
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
        title={draft?.id ? t("goals.editTitle") : t("goals.newTitle")}
        description={t("goals.modalDescription")}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDraft(null)}>
              {t("common.cancel")}
            </Button>
            <Button variant="primary" onClick={saveGoal} loading={saving}>
              {draft?.id ? t("common.saveChanges") : t("goals.createGoal")}
            </Button>
          </>
        }
      >
        {draft && (
          <div className="space-y-4">
            <Input
              label={t("goals.titleLabel")}
              value={draft.title}
              onChange={(event) =>
                setDraft({ ...draft, title: event.target.value })
              }
              placeholder={t("goals.titlePlaceholder")}
              autoFocus
            />

            <div className="grid grid-cols-2 gap-3">
              <Input
                label={t("goals.targetAmountLabel", { currency })}
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
                label={t("goals.targetDateLabel")}
                hint={t("common.optional")}
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
                label={t("goals.alreadySavedLabel", { currency })}
                hint={t("common.optional")}
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
              label={t("investments.notesLabel")}
              hint={t("common.optional")}
              rows={2}
              value={draft.notes}
              onChange={(event) =>
                setDraft({ ...draft, notes: event.target.value })
              }
              placeholder={t("goals.notesPlaceholder")}
            />

            {draft.target_date && Number(draft.target_amount) > 0 && (
              <Callout tone="info">
                {t("goals.targetDateHelp")}
              </Callout>
            )}
          </div>
        )}
      </Modal>

      {/* Add money */}
      <Modal
        open={money !== null}
        onClose={() => setMoney(null)}
        title={
          money ? t("goals.addMoneyTitle", { title: money.goal.title }) : ""
        }
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setMoney(null)}>
              {t("common.cancel")}
            </Button>
            <Button variant="primary" onClick={addMoney} loading={saving}>
              {t("goals.addMoney")}
            </Button>
          </>
        }
      >
        {money && (
          <div className="space-y-4">
            <Input
              label={t("investments.amountLabel", { currency })}
              hint={t("goals.negativeCorrects")}
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
              label={t("finance.colDate")}
              type="date"
              value={money.date}
              onChange={(event) =>
                setMoney({ ...money, date: event.target.value })
              }
            />
            <Input
              label={t("investments.noteLabel")}
              hint={t("common.optional")}
              value={money.note}
              onChange={(event) =>
                setMoney({ ...money, note: event.target.value })
              }
              placeholder={t("goals.notePlaceholder")}
            />
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && removeGoal(deleting)}
        title={t("goals.deleteTitle")}
        message={
          <>
            <strong className="text-ink">{deleting?.title}</strong>{" "}
            {t("goals.deleteMessage", {
              count: deleting?.contributions.length ?? 0,
            })}
          </>
        }
      />
    </>
  );
}
