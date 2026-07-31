"use client";

import {
  ArrowRight,
  Bell,
  CalendarDays,
  CheckCircle2,
  Circle,
  Dumbbell,
  Flame,
  Footprints,
  HeartPulse,
  NotebookPen,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { Page } from "@/components/layout/Shell";
import {
  ACTIVITY_COLORS,
  Badge,
  EXPENSE_COLORS,
  PriorityBadge,
} from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Callout, EmptyState, Skeleton } from "@/components/ui/Feedback";
import { Progress, Ring } from "@/components/ui/Progress";
import { useApi } from "@/lib/client";
import type {
  ActivityCategory,
  DashboardData,
  ExpenseCategory,
} from "@/lib/types";
import {
  clamp,
  formatDate,
  formatMoney,
  formatTime,
  minutesOf,
  relativeDay,
  today,
} from "@/lib/utils";
import type { TranslationKey } from "@/lib/i18n";

/** Returns a translation key rather than text, so the caller localises it. */
function greetingKey(): TranslationKey {
  const hour = new Date().getHours();
  if (hour < 5) return "dash.stillUp";
  if (hour < 12) return "dash.goodMorning";
  if (hour < 18) return "dash.goodAfternoon";
  return "dash.goodEvening";
}

/** "Open" link used in each card header. */
function OpenLink({ href }: { href: string }) {
  const { t } = useLanguage();
  return (
    <Link
      href={href}
      className="text-accent flex items-center gap-1 text-[13px] font-medium hover:underline"
    >
      {t("common.open")}
      <ArrowRight className="size-3.5" />
    </Link>
  );
}

/** A checklist row inside the progress card. */
function ProgressRow({
  label,
  done,
  total,
  complete,
}: {
  label: string;
  done?: number;
  total?: number;
  complete?: boolean;
}) {
  const isDone = complete ?? (total ? done === total : false);
  const hasCounts = total !== undefined && total > 0;

  return (
    <li className="flex items-center gap-2 text-[13px]">
      {isDone ? (
        <CheckCircle2 className="size-4 shrink-0" style={{ color: "var(--good)" }} />
      ) : (
        <Circle className="text-ink-3 size-4 shrink-0" />
      )}
      <span className={isDone ? "text-ink-3 line-through" : "text-ink-2"}>
        {label}
      </span>
      {hasCounts && (
        <span className="text-ink-3 ml-auto tabular-nums">
          {done}/{total}
        </span>
      )}
    </li>
  );
}

export default function DashboardPage() {
  const { t, tv, locale } = useLanguage();
  const day = today();
  const { data, loading, error } = useApi<DashboardData>(
    `/api/dashboard?date=${day}`,
  );

  const nowMinutes = useMemo(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  }, []);

  // Passed to relativeDay so "Today"/"Tomorrow"/"Yesterday" follow the language.
  const relLabels = {
    today: t("date.today"),
    tomorrow: t("date.tomorrow"),
    yesterday: t("date.yesterday"),
  };

  if (loading && !data) {
    return (
      <Page title={t(greetingKey())} subtitle={formatDate(day, undefined, locale)}>
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-56" />
          ))}
        </div>
      </Page>
    );
  }

  if (error || !data) {
    return (
      <Page title={t(greetingKey())} subtitle={formatDate(day, undefined, locale)}>
        <Callout tone="danger">
          {error ?? t("dash.loadFailed")}
        </Callout>
      </Page>
    );
  }

  const { progress, finance, activities, reminders, workout, diary, fitness } =
    data;
  const currency = finance.settings.currency;

  const scoreColor =
    progress.score >= 70
      ? "var(--good)"
      : progress.score >= 40
        ? "var(--warning)"
        : "var(--serious)";

  const budgetUsed =
    finance.settings.monthly_limit > 0
      ? (finance.spent_month / finance.settings.monthly_limit) * 100
      : 0;
  const overBudget = budgetUsed > 100;

  const currentActivity = activities.find(
    (activity) =>
      minutesOf(activity.start_time) <= nowMinutes &&
      minutesOf(activity.end_time) > nowMinutes,
  );
  const nextActivity = activities.find(
    (activity) => minutesOf(activity.start_time) > nowMinutes,
  );

  const topCategories = finance.by_category.slice(0, 5);
  const categoryMax = Math.max(1, ...topCategories.map((row) => row.total));

  return (
    <Page
      title={t(greetingKey())}
      subtitle={formatDate(day, undefined, locale)}
      actions={
        data.streak > 0 && (
          <Badge
            color="var(--series-2)"
            className="h-8 gap-1.5 px-2.5 text-[13px]"
          >
            <Flame className="size-3.5" />
            {t("dash.dayStreak", { count: data.streak })}
          </Badge>
        )
      }
    >
      <div className="stagger grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {/* Progress overview */}
        <Card>
          <CardHeader
            title={t("dash.todaysProgress")}
            subtitle={
              progress.score >= 70
                ? t("dash.scoreStrong")
                : progress.score >= 40
                  ? t("dash.scoreHalfway")
                  : t("dash.scoreNothing")
            }
          />
          <CardBody className="flex items-center gap-5">
            <Ring value={progress.score} color={scoreColor} size={104} thickness={9}>
              <p className="text-ink text-2xl leading-none font-semibold">
                {progress.score}
                <span className="text-ink-3 text-sm font-normal">%</span>
              </p>
            </Ring>

            <ul className="min-w-0 flex-1 space-y-1.5">
              <ProgressRow
                label={t("dash.rowSchedule")}
                done={progress.activities_done}
                total={progress.activities_total}
              />
              <ProgressRow
                label={t("dash.rowReminders")}
                done={progress.reminders_done}
                total={progress.reminders_total}
              />
              <ProgressRow
                label={t("dash.rowWorkout")}
                done={progress.exercises_done}
                total={progress.exercises_total}
              />
              <ProgressRow
                label={t("dash.rowDiary")}
                complete={progress.diary_written}
              />
              <ProgressRow
                label={t("dash.rowBudget")}
                complete={progress.budget_ok}
              />
            </ul>
          </CardBody>
        </Card>

        {/* Today's schedule */}
        <Card>
          <CardHeader
            title={t("dash.todaysSchedule")}
            icon={<CalendarDays className="size-4" />}
            subtitle={
              currentActivity
                ? t("dash.nowActivity", { title: currentActivity.title })
                : nextActivity
                  ? t("dash.nextActivity", {
                      title: nextActivity.title,
                      time: formatTime(nextActivity.start_time),
                    })
                  : activities.length > 0
                    ? t("dash.nothingLeftToday")
                    : undefined
            }
            action={<OpenLink href="/routine" />}
          />
          <CardBody>
            {activities.length === 0 ? (
              <EmptyState
                icon={<CalendarDays className="size-5" />}
                title={t("dash.noActivitiesTitle")}
                message={t("dash.noActivitiesMessage")}
                action={
                  <LinkButton variant="primary" size="sm" href="/routine">
                    {t("dash.planToday")}
                  </LinkButton>
                }
              />
            ) : (
              <ol className="space-y-1">
                {activities.slice(0, 6).map((activity) => {
                  const isNow = activity.id === currentActivity?.id;
                  const past = minutesOf(activity.end_time) <= nowMinutes;

                  return (
                    <li
                      key={activity.id}
                      className={
                        "flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors " +
                        (isNow ? "bg-accent-soft" : "hover:bg-surface-2")
                      }
                    >
                      <span
                        aria-hidden
                        className="h-7 w-1 shrink-0 rounded-full"
                        style={{
                          background:
                            ACTIVITY_COLORS[activity.category as ActivityCategory],
                          opacity: past && !isNow ? 0.4 : 1,
                        }}
                      />
                      <span className="text-ink-3 w-[4.25rem] shrink-0 text-[12px] tabular-nums">
                        {formatTime(activity.start_time)}
                      </span>
                      <span
                        className={
                          "min-w-0 flex-1 truncate text-[13.5px] " +
                          (activity.completed
                            ? "text-ink-3 line-through"
                            : past
                              ? "text-ink-3"
                              : "text-ink")
                        }
                      >
                        {activity.title}
                      </span>
                      {isNow && (
                        <Badge color="var(--accent)" className="shrink-0">
                          {t("dash.now")}
                        </Badge>
                      )}
                    </li>
                  );
                })}
                {activities.length > 6 && (
                  <li className="text-ink-3 px-2 pt-1 text-[12.5px]">
                    {t("dash.moreToday", { count: activities.length - 6 })}
                  </li>
                )}
              </ol>
            )}
          </CardBody>
        </Card>

        {/* Upcoming reminders */}
        <Card>
          <CardHeader
            title={t("dash.upcomingReminders")}
            icon={<Bell className="size-4" />}
            subtitle={t("dash.nextSevenDays")}
            action={<OpenLink href="/reminders" />}
          />
          <CardBody>
            {reminders.length === 0 ? (
              <EmptyState
                icon={<Bell className="size-5" />}
                title={t("dash.nothingPendingTitle")}
                message={t("dash.nothingPendingMessage")}
              />
            ) : (
              <ul className="space-y-1.5">
                {reminders.slice(0, 6).map((reminder) => (
                  <li
                    key={`${reminder.id}-${reminder.occurrence_date}`}
                    className="hover:bg-surface-2 flex items-start gap-2.5 rounded-lg px-2 py-1.5 transition-colors"
                  >
                    <span className="text-ink-3 mt-px w-[5.25rem] shrink-0 text-[12px]">
                      {relativeDay(
                        reminder.occurrence_date,
                        locale,
                        relLabels,
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-ink truncate text-[13.5px]">
                        {reminder.title}
                      </p>
                      <p className="text-ink-3 text-[12px]">
                        {formatTime(reminder.time)}
                        {reminder.repeat_rule !== "none" &&
                          ` ${t("dash.repeatsRule", {
                            rule: t(`repeat.${reminder.repeat_rule}`),
                          })}`}
                      </p>
                    </div>
                    <PriorityBadge priority={reminder.priority} />
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        {/* Budget */}
        <Card>
          <CardHeader
            title={t("dash.thisMonthsMoney")}
            icon={<Wallet className="size-4" />}
            subtitle={
              finance.settings.monthly_limit > 0
                ? t("dash.ofLimit", {
                    spent: formatMoney(finance.spent_month, currency, locale),
                    limit: formatMoney(
                      finance.settings.monthly_limit,
                      currency,
                      locale,
                    ),
                  })
                : t("dash.noLimitSet")
            }
            action={<OpenLink href="/finance" />}
          />
          <CardBody className="space-y-4">
            <div>
              <div className="mb-2 flex items-end justify-between gap-3">
                <div>
                  <p className="text-ink text-xl leading-none font-semibold tracking-tight">
                    {formatMoney(finance.remaining, currency, locale)}
                  </p>
                  <p className="text-ink-3 mt-1 text-[12.5px]">
                    {t("dash.leftThisMonth")}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-ink text-[13px] font-medium tabular-nums">
                    {formatMoney(finance.daily_allowance, currency, locale)}
                  </p>
                  <p className="text-ink-3 text-[12px]">
                    {t("dash.perDayFromHere")}
                  </p>
                </div>
              </div>

              <Progress
                value={clamp(budgetUsed, 0, 100)}
                color={
                  overBudget
                    ? "var(--critical)"
                    : budgetUsed > 80
                      ? "var(--warning)"
                      : "var(--good)"
                }
                label={t("finance.budgetUsed")}
              />

              <div className="mt-1.5 flex items-center gap-1.5 text-[12px]">
                {overBudget ? (
                  <>
                    <TrendingUp className="text-critical size-3.5" />
                    <span style={{ color: "var(--critical)" }}>
                      {t("dash.percentOverLimit", {
                        percent: Math.round(budgetUsed - 100),
                      })}
                    </span>
                  </>
                ) : (
                  <>
                    <TrendingDown
                      className="size-3.5"
                      style={{ color: "var(--good-ink)" }}
                    />
                    <span className="text-ink-3">
                      {t("dash.percentOfLimitUsed", {
                        percent: Math.round(budgetUsed),
                      })}
                    </span>
                  </>
                )}
                <span className="text-ink-3 ml-auto">
                  {t("dash.spentToday", {
                    amount: formatMoney(finance.spent_today, currency, locale),
                  })}
                </span>
              </div>
            </div>

            {topCategories.length > 0 && (
              <div className="space-y-1.5">
                {topCategories.map((row) => (
                  <div key={row.category} className="flex items-center gap-2">
                    <span className="text-ink-2 w-[6.5rem] shrink-0 truncate text-[12.5px]">
                      {tv("expense", row.category)}
                    </span>
                    <div className="bg-surface-2 h-2 flex-1 overflow-hidden rounded-full">
                      <div
                        className="h-full rounded-full transition-[width] duration-500"
                        style={{
                          width: `${(row.total / categoryMax) * 100}%`,
                          background:
                            EXPENSE_COLORS[row.category as ExpenseCategory] ??
                            "var(--ink-3)",
                        }}
                      />
                    </div>
                    <span className="text-ink w-16 shrink-0 text-right text-[12.5px] tabular-nums">
                      {formatMoney(row.total, currency, locale)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        {/* Workout */}
        <Card>
          <CardHeader
            title={t("dash.workoutPlan")}
            icon={<Dumbbell className="size-4" />}
            subtitle={
              workout
                ? t("dash.workoutSubtitle", {
                    name: workout.name,
                    group: tv("muscle", workout.muscle_group),
                  })
                : t("dash.nothingPlannedToday")
            }
            action={<OpenLink href="/workouts" />}
          />
          <CardBody>
            {!workout ? (
              <EmptyState
                icon={<Dumbbell className="size-5" />}
                title={t("dash.restDayTitle")}
                message={t("dash.restDayMessage")}
                action={
                  <LinkButton variant="primary" size="sm" href="/workouts">
                    {t("dash.startWorkout")}
                  </LinkButton>
                }
              />
            ) : (
              <>
                <div className="mb-3">
                  <Progress
                    value={progress.exercises_done}
                    max={Math.max(1, progress.exercises_total)}
                    color="var(--series-2)"
                    label={t("dash.exercisesCompleted")}
                  />
                  <p className="text-ink-3 mt-1.5 text-[12px]">
                    {t("dash.exercisesDone", {
                      done: progress.exercises_done,
                      total: progress.exercises_total,
                    })}
                  </p>
                </div>
                <ul className="space-y-1">
                  {workout.exercises.slice(0, 5).map((exercise) => (
                    <li
                      key={exercise.id}
                      className="flex items-center gap-2 text-[13px]"
                    >
                      {exercise.completed ? (
                        <CheckCircle2
                          className="size-3.5 shrink-0"
                          style={{ color: "var(--good)" }}
                        />
                      ) : (
                        <Circle className="text-ink-3 size-3.5 shrink-0" />
                      )}
                      <span
                        className={
                          "min-w-0 flex-1 truncate " +
                          (exercise.completed
                            ? "text-ink-3 line-through"
                            : "text-ink-2")
                        }
                      >
                        {exercise.name}
                      </span>
                      <span className="text-ink-3 shrink-0 text-[12px] tabular-nums">
                        {exercise.sets}x{exercise.reps}
                        {exercise.weight > 0 && ` - ${exercise.weight}kg`}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </CardBody>
        </Card>

        {/* Diary + fitness */}
        <div className="space-y-4">
          <Card>
            <CardHeader
              title={t("dash.recentDiary")}
              icon={<NotebookPen className="size-4" />}
              subtitle={
                diary ? relativeDay(diary.date, locale, relLabels) : undefined
              }
              action={<OpenLink href="/diary" />}
            />
            <CardBody>
              {!diary ? (
                <EmptyState
                  icon={<NotebookPen className="size-5" />}
                  title={t("dash.nothingWrittenTitle")}
                  message={t("dash.nothingWrittenMessage")}
                  action={
                    <LinkButton variant="primary" size="sm" href="/diary">
                      {t("dash.writeEntry")}
                    </LinkButton>
                  }
                />
              ) : (
                <>
                  {diary.title && (
                    <p className="text-ink mb-1 text-[13.5px] font-medium">
                      {diary.title}
                    </p>
                  )}
                  <p className="text-ink-2 line-clamp-4 text-[13px] leading-relaxed">
                    {diary.content}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <Badge color="var(--series-5)">
                      {t("dash.moodBadge", { value: diary.mood })}
                    </Badge>
                    {diary.tags.slice(0, 3).map((tag) => (
                      <Badge key={tag}>{tv("tag", tag)}</Badge>
                    ))}
                  </div>
                </>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title={t("dash.fitnessData")}
              icon={<HeartPulse className="size-4" />}
              subtitle={
                fitness
                  ? t("dash.syncedFrom", {
                      when: relativeDay(
                        fitness.date,
                        locale,
                        relLabels,
                      ).toLocaleLowerCase(locale),
                      provider: tv("provider", fitness.provider),
                    })
                  : t("dash.noTracker")
              }
              action={<OpenLink href="/fitness" />}
            />
            <CardBody>
              {!fitness ? (
                <EmptyState
                  icon={<Footprints className="size-5" />}
                  title={t("dash.connectTrackerTitle")}
                  message={t("dash.connectTrackerMessage")}
                  action={
                    <LinkButton variant="primary" size="sm" href="/fitness">
                      {t("dash.connect")}
                    </LinkButton>
                  }
                />
              ) : (
                <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    {
                      label: t("dash.steps"),
                      value: fitness.steps.toLocaleString(locale),
                      color: "var(--series-1)",
                    },
                    {
                      label: t("dash.calories"),
                      value: fitness.calories.toLocaleString(locale),
                      color: "var(--series-2)",
                    },
                    {
                      label: t("dash.activeMin"),
                      value: String(fitness.active_minutes),
                      color: "var(--series-3)",
                    },
                    {
                      label: t("dash.restingHr"),
                      value: fitness.resting_hr ? `${fitness.resting_hr}` : "-",
                      color: "var(--series-8)",
                    },
                  ].map((metric) => (
                    <div key={metric.label}>
                      <dt className="text-ink-3 text-[11.5px]">{metric.label}</dt>
                      <dd
                        className="mt-0.5 text-[17px] font-semibold tabular-nums"
                        style={{ color: metric.color }}
                      >
                        {metric.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </Page>
  );
}
