"use client";

import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  ListChecks,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Page } from "@/components/layout/Shell";
import { ACTIVITY_COLORS, Badge, LegendKey } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Callout, EmptyState, Skeleton } from "@/components/ui/Feedback";
import {
  Checkbox,
  Input,
  Segmented,
  Select,
  Textarea,
} from "@/components/ui/Field";
import { ConfirmDialog, Modal } from "@/components/ui/Modal";
import { StackedBar } from "@/components/ui/Progress";
import { useToast } from "@/components/ui/Toast";
import { api, useApi } from "@/lib/client";
import { useLanguage } from "@/components/LanguageProvider";
import { ACTIVITY_CATEGORIES, type Activity, type ActivityCategory } from "@/lib/types";
import {
  addDays,
  durationLabel,
  formatDate,
  formatTime,
  minutesOf,
  today,
} from "@/lib/utils";

const DAY_START = 5; // 05:00
const DAY_END = 24; // midnight
const HOUR_HEIGHT = 56; // px

type Draft = {
  id?: string;
  title: string;
  category: ActivityCategory;
  start_time: string;
  end_time: string;
  notes: string;
};

const EMPTY: Draft = {
  title: "",
  category: "personal",
  start_time: "09:00",
  end_time: "10:00",
  notes: "",
};

/**
 * Vertical hour grid with activities positioned by time. Overlapping activities
 * are laid out side by side so nothing is hidden.
 */
function Timeline({
  activities,
  onEdit,
}: {
  activities: Activity[];
  onEdit: (activity: Activity) => void;
}) {
  const { t } = useLanguage();
  const hours = Array.from(
    { length: DAY_END - DAY_START + 1 },
    (_, index) => DAY_START + index,
  );

  // Group into overlap clusters, then place each activity in a column.
  const placed = useMemo(() => {
    const sorted = [...activities].sort(
      (a, b) => minutesOf(a.start_time) - minutesOf(b.start_time),
    );

    const columns: { end: number }[] = [];
    return sorted.map((activity) => {
      const start = minutesOf(activity.start_time);
      const end = minutesOf(activity.end_time);

      let column = columns.findIndex((existing) => existing.end <= start);
      if (column === -1) {
        columns.push({ end });
        column = columns.length - 1;
      } else {
        columns[column].end = end;
      }

      return { activity, start, end, column };
    });
  }, [activities]);

  const columnCount = Math.max(1, ...placed.map((item) => item.column + 1));
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  const showNow = nowMinutes >= DAY_START * 60 && nowMinutes <= DAY_END * 60;

  return (
    <div className="relative overflow-x-auto">
      <div
        className="relative min-w-[22rem]"
        style={{ height: (DAY_END - DAY_START) * HOUR_HEIGHT + 8 }}
      >
        {/* Hour rules */}
        {hours.map((hour) => (
          <div
            key={hour}
            className="absolute inset-x-0 flex items-start"
            style={{ top: (hour - DAY_START) * HOUR_HEIGHT }}
          >
            <span className="text-ink-3 w-14 shrink-0 -translate-y-1.5 pr-2 text-right text-[11px] tabular-nums">
              {hour === 24
                ? t("routine.midnight")
                : formatTime(`${String(hour).padStart(2, "0")}:00`)}
            </span>
            <span className="border-line mt-0 flex-1 border-t" />
          </div>
        ))}

        {/* Current-time marker */}
        {showNow && (
          <div
            className="pointer-events-none absolute inset-x-0 z-20 flex items-center"
            style={{
              top: ((nowMinutes - DAY_START * 60) / 60) * HOUR_HEIGHT,
            }}
          >
            <span className="text-accent w-14 shrink-0 pr-2 text-right text-[10.5px] font-medium">
              now
            </span>
            <span className="bg-accent h-px flex-1" />
          </div>
        )}

        {/* Activity blocks */}
        <div className="absolute inset-y-0 left-14 right-0">
          {placed.map(({ activity, start, end, column }) => {
            const top = ((start - DAY_START * 60) / 60) * HOUR_HEIGHT;
            const height = Math.max(
              22,
              ((end - start) / 60) * HOUR_HEIGHT - 3,
            );
            const width = 100 / columnCount;
            const color = ACTIVITY_COLORS[activity.category];

            return (
              <button
                key={activity.id}
                onClick={() => onEdit(activity)}
                className="group absolute overflow-hidden rounded-lg px-2 py-1 text-left transition-all duration-150 hover:z-10 hover:shadow-[var(--shadow)]"
                style={{
                  top,
                  height,
                  left: `calc(${column * width}% + 2px)`,
                  width: `calc(${width}% - 4px)`,
                  background: `color-mix(in oklab, ${color} 13%, var(--surface))`,
                  borderLeft: `3px solid ${color}`,
                  opacity: activity.completed ? 0.6 : 1,
                }}
                title={t("routine.blockTooltip", {
                  title: activity.title,
                  start: formatTime(activity.start_time),
                  end: formatTime(activity.end_time),
                })}
              >
                <span
                  className={
                    "block truncate text-[12.5px] font-medium " +
                    (activity.completed ? "text-ink-3 line-through" : "text-ink")
                  }
                >
                  {activity.title}
                </span>
                {height > 34 && (
                  <span className="text-ink-3 block truncate text-[11px] tabular-nums">
                    {formatTime(activity.start_time)} -{" "}
                    {formatTime(activity.end_time)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function RoutinePage() {
  const { push } = useToast();
  const { t, tv, locale } = useLanguage();
  const [date, setDate] = useState(today());
  const [view, setView] = useState<"timeline" | "list">("timeline");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [deleting, setDeleting] = useState<Activity | null>(null);
  const [saving, setSaving] = useState(false);

  const { data, loading, error, reload } = useApi<{ activities: Activity[] }>(
    `/api/activities?from=${date}&to=${date}`,
  );
  const activities = data?.activities ?? [];

  // Minutes per category, for the day-composition bar.
  const composition = useMemo(() => {
    const totals = new Map<ActivityCategory, number>();
    for (const activity of activities) {
      const minutes = Math.max(
        0,
        minutesOf(activity.end_time) - minutesOf(activity.start_time),
      );
      totals.set(
        activity.category,
        (totals.get(activity.category) ?? 0) + minutes,
      );
    }
    return [...totals.entries()]
      .map(([category, minutes]) => ({
        // `category` stays the stable key; `label` is what the user reads.
        category,
        label: tv("category", category),
        value: minutes,
        color: ACTIVITY_COLORS[category],
      }))
      .sort((a, b) => b.value - a.value);
    // tv depends on the selected language, so it belongs in the dep list.
  }, [activities, tv]);

  const plannedMinutes = composition.reduce((acc, row) => acc + row.value, 0);
  const doneCount = activities.filter((activity) => activity.completed).length;

  async function save() {
    if (!draft) return;
    if (!draft.title.trim()) {
      push(t("routine.needName"), "error");
      return;
    }
    if (draft.end_time <= draft.start_time) {
      push(t("routine.endAfterStart"), "error");
      return;
    }

    setSaving(true);
    try {
      if (draft.id) {
        await api.patch(`/api/activities/${draft.id}`, { ...draft, date });
        push(t("routine.updated"));
      } else {
        await api.post("/api/activities", { ...draft, date });
        push(t("routine.added"));
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

  async function toggle(activity: Activity) {
    try {
      await api.patch(`/api/activities/${activity.id}`, {
        completed: activity.completed !== 1,
      });
      await reload();
    } catch {
      push(t("routine.couldntUpdate"), "error");
    }
  }

  async function remove(activity: Activity) {
    try {
      await api.delete(`/api/activities/${activity.id}`);
      push(t("routine.deleted"));
      await reload();
    } catch {
      push(t("routine.couldntDelete"), "error");
    }
  }

  return (
    <Page
      title={t("routine.title")}
      subtitle={formatDate(date, undefined, locale)}
      actions={
        <>
          <div className="border-line bg-surface flex items-center rounded-lg border">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setDate(addDays(date, -1))}
              aria-label={t("routine.prevDay")}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value || today())}
              className="text-ink w-[8.5rem] bg-transparent px-1 text-[13px] outline-none"
              aria-label={t("routine.dateAria")}
            />
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setDate(addDays(date, 1))}
              aria-label={t("routine.nextDay")}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>

          {date !== today() && (
            <Button variant="ghost" size="sm" onClick={() => setDate(today())}>
              {t("common.today")}
            </Button>
          )}

          <Segmented
            value={view}
            onChange={setView}
            size="sm"
            options={[
              {
                value: "timeline",
                label: (
                  <span className="flex items-center gap-1.5">
                    <Clock className="size-3.5" />
                    {t("routine.viewTimeline")}
                  </span>
                ),
              },
              {
                value: "list",
                label: (
                  <span className="flex items-center gap-1.5">
                    <ListChecks className="size-3.5" />
                    {t("routine.viewList")}
                  </span>
                ),
              },
            ]}
          />

          <Button
            variant="primary"
            size="sm"
            onClick={() => setDraft({ ...EMPTY })}
          >
            <Plus className="size-4" />
            {t("routine.addActivity")}
          </Button>
        </>
      }
    >
      {error && (
        <Callout tone="danger" className="mb-4">
          {error}
        </Callout>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        {/* min-w-0 so the timeline scrolls inside its own container. */}
        <div className="min-w-0 space-y-4">
          <Card>
            <CardHeader
              title={
                view === "timeline" ? t("routine.yourDay") : t("routine.activities")
              }
              subtitle={
                activities.length > 0
                  ? t("routine.summary", {
                      count: activities.length,
                      done: doneCount,
                      hours: Math.floor(plannedMinutes / 60),
                      minutes: plannedMinutes % 60,
                    })
                  : undefined
              }
            />
            <CardBody>
              {loading && !data ? (
                <Skeleton className="h-96" />
              ) : activities.length === 0 ? (
                <EmptyState
                  icon={<CalendarDays className="size-5" />}
                  title={t("routine.emptyTitle")}
                  message={t("routine.emptyMessage")}
                  action={
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setDraft({ ...EMPTY })}
                    >
                      <Plus className="size-4" />
                      {t("routine.addActivity")}
                    </Button>
                  }
                />
              ) : view === "timeline" ? (
                <Timeline
                  activities={activities}
                  onEdit={(activity) =>
                    setDraft({
                      id: activity.id,
                      title: activity.title,
                      category: activity.category,
                      start_time: activity.start_time,
                      end_time: activity.end_time,
                      notes: activity.notes,
                    })
                  }
                />
              ) : (
                <ul className="divide-line divide-y">
                  {activities.map((activity) => (
                    <li
                      key={activity.id}
                      className="group flex items-start gap-3 py-2.5 first:pt-0 last:pb-0"
                    >
                      <div className="pt-0.5">
                        <Checkbox
                          checked={activity.completed === 1}
                          onChange={() => toggle(activity)}
                        />
                      </div>

                      <span
                        aria-hidden
                        className="mt-1 h-8 w-1 shrink-0 rounded-full"
                        style={{ background: ACTIVITY_COLORS[activity.category] }}
                      />

                      <div className="min-w-0 flex-1">
                        <p
                          className={
                            "truncate text-sm " +
                            (activity.completed
                              ? "text-ink-3 line-through"
                              : "text-ink")
                          }
                        >
                          {activity.title}
                        </p>
                        <p className="text-ink-3 mt-0.5 text-[12px]">
                          {t("routine.timeRange", {
                            start: formatTime(activity.start_time),
                            end: formatTime(activity.end_time),
                            duration: durationLabel(
                              activity.start_time,
                              activity.end_time,
                            ),
                          })}
                        </p>
                        {activity.notes && (
                          <p className="text-ink-3 mt-1 text-[12.5px] leading-relaxed">
                            {activity.notes}
                          </p>
                        )}
                      </div>

                      <Badge color={ACTIVITY_COLORS[activity.category]}>
                        {activity.category}
                      </Badge>

                      <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t("common.edit")}
                          onClick={() =>
                            setDraft({
                              id: activity.id,
                              title: activity.title,
                              category: activity.category,
                              start_time: activity.start_time,
                              end_time: activity.end_time,
                              notes: activity.notes,
                            })
                          }
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t("common.delete")}
                          onClick={() => setDeleting(activity)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader
              title={t("routine.howDaySplits")}
              subtitle={
                plannedMinutes > 0
                  ? t("routine.accountedFor", {
                      hours: Math.floor(plannedMinutes / 60),
                      minutes: plannedMinutes % 60,
                    })
                  : t("routine.nothingPlannedYet")
              }
            />
            <CardBody>
              {composition.length === 0 ? (
                <p className="text-ink-3 text-[13px]">
                  {t("routine.addToSeeSplit")}
                </p>
              ) : (
                <>
                  <StackedBar
                    segments={composition}
                    total={plannedMinutes}
                    height={12}
                  />
                  <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5">
                    {composition.map((row) => (
                      <LegendKey
                        key={row.category}
                        color={row.color}
                        label={row.label}
                        value={`${Math.floor(row.value / 60)}h ${row.value % 60}m`}
                      />
                    ))}
                  </div>
                </>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Add / edit */}
      <Modal
        open={draft !== null}
        onClose={() => setDraft(null)}
        title={
          draft?.id ? t("routine.editActivity") : t("routine.addActivity")
        }
        description={formatDate(date, undefined, locale)}
        footer={
          <>
            {draft?.id && (
              <Button
                variant="ghost"
                className="mr-auto"
                onClick={() => {
                  const target = activities.find((a) => a.id === draft.id);
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
            <Button variant="primary" onClick={save} loading={saving}>
              {draft?.id ? t("common.saveChanges") : t("routine.addActivity")}
            </Button>
          </>
        }
      >
        {draft && (
          <div className="space-y-4">
            <Input
              label={t("routine.titleLabel")}
              value={draft.title}
              onChange={(event) =>
                setDraft({ ...draft, title: event.target.value })
              }
              placeholder={t("routine.titlePlaceholder")}
              autoFocus
            />

            <div className="grid grid-cols-2 gap-3">
              <Input
                label={t("routine.startLabel")}
                type="time"
                value={draft.start_time}
                onChange={(event) =>
                  setDraft({ ...draft, start_time: event.target.value })
                }
              />
              <Input
                label={t("routine.endLabel")}
                type="time"
                value={draft.end_time}
                onChange={(event) =>
                  setDraft({ ...draft, end_time: event.target.value })
                }
              />
            </div>

            <Select
              label={t("finance.colCategory")}
              value={draft.category}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  category: event.target.value as ActivityCategory,
                })
              }
            >
              {ACTIVITY_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {tv("category", category)}
                </option>
              ))}
            </Select>

            <Textarea
              label={t("investments.notesLabel")}
              hint={t("common.optional")}
              rows={3}
              value={draft.notes}
              onChange={(event) =>
                setDraft({ ...draft, notes: event.target.value })
              }
              placeholder={t("routine.notesPlaceholder")}
            />
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && remove(deleting)}
        title={t("routine.deleteTitle")}
        message={
          <>
            <strong className="text-ink">{deleting?.title}</strong> will be removed
            {t("routine.deleteMessage", {
              date: formatDate(date, undefined, locale),
            })}
          </>
        }
      />
    </Page>
  );
}
