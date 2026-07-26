"use client";

import {
  Bell,
  BellRing,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  Repeat,
  Table2,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Page } from "@/components/layout/Shell";
import { Badge, PriorityBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Callout, EmptyState, Skeleton } from "@/components/ui/Feedback";
import { Checkbox, Input, Segmented, Select, Textarea } from "@/components/ui/Field";
import { ConfirmDialog, Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { api, useApi } from "@/lib/client";
import type {
  Priority,
  Reminder,
  ReminderOccurrence,
  RepeatRule,
} from "@/lib/types";
import {
  addDays,
  addMonths,
  cn,
  endOfMonth,
  formatDate,
  formatTime,
  fromDateKey,
  minutesOf,
  monthLabel,
  startOfMonth,
  toDateKey,
  today,
} from "@/lib/utils";

const PRIORITY_COLOR: Record<Priority, string> = {
  high: "var(--critical)",
  medium: "var(--warning)",
  low: "var(--ink-3)",
};

const TABLE_START = 6;
const TABLE_END = 23;

type Draft = {
  id?: string;
  title: string;
  description: string;
  date: string;
  time: string;
  priority: Priority;
  repeat_rule: RepeatRule;
};

function emptyDraft(date: string): Draft {
  return {
    title: "",
    description: "",
    date,
    time: "09:00",
    priority: "medium",
    repeat_rule: "none",
  };
}

/** Month grid. Each day shows priority dots for what's scheduled. */
function MonthCalendar({
  month,
  selected,
  occurrences,
  onSelect,
}: {
  month: string;
  selected: string;
  occurrences: ReminderOccurrence[];
  onSelect: (date: string) => void;
}) {
  const first = fromDateKey(startOfMonth(month));
  const last = fromDateKey(endOfMonth(month));

  // Pad to a Monday-first grid.
  const leading = (first.getDay() + 6) % 7;
  const cells: (string | null)[] = Array.from({ length: leading }, () => null);
  for (let day = 1; day <= last.getDate(); day += 1) {
    cells.push(
      toDateKey(new Date(first.getFullYear(), first.getMonth(), day)),
    );
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const byDate = new Map<string, ReminderOccurrence[]>();
  for (const occurrence of occurrences) {
    if (!byDate.has(occurrence.occurrence_date)) {
      byDate.set(occurrence.occurrence_date, []);
    }
    byDate.get(occurrence.occurrence_date)!.push(occurrence);
  }

  const t = today();

  return (
    <div>
      <div className="text-ink-3 mb-1 grid grid-cols-7 gap-1 text-center text-[11px] font-medium">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label) => (
          <div key={label} className="py-1">
            {label.slice(0, 1)}
            <span className="hidden sm:inline">{label.slice(1)}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((date, index) => {
          if (!date) return <div key={`pad-${index}`} />;

          const items = byDate.get(date) ?? [];
          const pending = items.filter((item) => !item.is_completed);
          const isSelected = date === selected;
          const isToday = date === t;

          return (
            <button
              key={date}
              onClick={() => onSelect(date)}
              aria-current={isSelected ? "date" : undefined}
              className={cn(
                "relative flex aspect-square flex-col items-center justify-center rounded-lg text-[13px] transition-all duration-150",
                isSelected
                  ? "bg-accent text-accent-ink font-semibold"
                  : isToday
                    ? "bg-accent-soft text-accent font-semibold"
                    : "text-ink-2 hover:bg-surface-2",
              )}
            >
              {fromDateKey(date).getDate()}

              {items.length > 0 && (
                <span className="absolute bottom-1 flex gap-0.5">
                  {pending.slice(0, 3).map((item, dot) => (
                    <span
                      key={dot}
                      className="size-1 rounded-full"
                      style={{
                        background: isSelected
                          ? "var(--accent-ink)"
                          : PRIORITY_COLOR[item.priority],
                      }}
                    />
                  ))}
                  {pending.length === 0 && (
                    <span
                      className="size-1 rounded-full"
                      style={{
                        background: isSelected
                          ? "var(--accent-ink)"
                          : "var(--good)",
                      }}
                    />
                  )}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Hour-by-hour table for the selected day. */
function HourTable({
  occurrences,
  onToggle,
  onEdit,
  onAdd,
}: {
  occurrences: ReminderOccurrence[];
  onToggle: (occurrence: ReminderOccurrence) => void;
  onEdit: (occurrence: ReminderOccurrence) => void;
  onAdd: (time: string) => void;
}) {
  const rows = Array.from(
    { length: TABLE_END - TABLE_START + 1 },
    (_, index) => TABLE_START + index,
  );

  const byHour = new Map<number, ReminderOccurrence[]>();
  for (const occurrence of occurrences) {
    const hour = Math.floor(minutesOf(occurrence.time) / 60);
    if (!byHour.has(hour)) byHour.set(hour, []);
    byHour.get(hour)!.push(occurrence);
  }

  const currentHour = new Date().getHours();

  return (
    <div className="overflow-hidden">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-line border-b">
            <th className="text-ink-3 w-20 py-2 pr-2 text-[11.5px] font-medium">
              Time
            </th>
            <th className="text-ink-3 py-2 text-[11.5px] font-medium">
              Scheduled
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((hour) => {
            const items = byHour.get(hour) ?? [];
            const isNow = hour === currentHour;

            return (
              <tr
                key={hour}
                className={cn(
                  "border-line group border-b last:border-b-0",
                  isNow && "bg-accent-soft/40",
                )}
              >
                <td className="text-ink-3 py-1.5 pr-2 align-top text-[12px] tabular-nums">
                  {formatTime(`${String(hour).padStart(2, "0")}:00`)}
                </td>
                <td className="py-1.5">
                  {items.length === 0 ? (
                    <button
                      onClick={() =>
                        onAdd(`${String(hour).padStart(2, "0")}:00`)
                      }
                      className="text-ink-3 hover:text-accent flex h-7 w-full items-center gap-1.5 rounded-md px-1.5 text-left text-[12px] opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                    >
                      <Plus className="size-3" />
                      Add at this hour
                    </button>
                  ) : (
                    <ul className="space-y-1">
                      {items.map((item) => (
                        <li
                          key={`${item.id}-${item.occurrence_date}`}
                          className="hover:bg-surface-2 flex items-center gap-2 rounded-md px-1.5 py-1 transition-colors"
                        >
                          <Checkbox
                            checked={item.is_completed}
                            onChange={() => onToggle(item)}
                          />
                          <button
                            onClick={() => onEdit(item)}
                            className="min-w-0 flex-1 text-left"
                          >
                            <span
                              className={cn(
                                "block truncate text-[13px]",
                                item.is_completed
                                  ? "text-ink-3 line-through"
                                  : "text-ink",
                              )}
                            >
                              {item.title}
                            </span>
                            <span className="text-ink-3 text-[11.5px] tabular-nums">
                              {formatTime(item.time)}
                              {item.repeat_rule !== "none" &&
                                ` - ${item.repeat_rule}`}
                            </span>
                          </button>
                          <PriorityBadge priority={item.priority} />
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function RemindersPage() {
  const { push } = useToast();
  const [month, setMonth] = useState(startOfMonth(today()));
  const [selected, setSelected] = useState(today());
  const [view, setView] = useState<"table" | "list">("table");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [deleting, setDeleting] = useState<Reminder | null>(null);
  const [saving, setSaving] = useState(false);

  // Pull the whole month plus a fortnight, so the "upcoming" list has runway.
  const rangeStart = startOfMonth(month);
  const rangeEnd = addDays(endOfMonth(month), 14);

  const { data, loading, error, reload } = useApi<{
    reminders: Reminder[];
    occurrences: ReminderOccurrence[];
  }>(`/api/reminders?from=${rangeStart}&to=${rangeEnd}`);

  const occurrences = data?.occurrences ?? [];
  const reminders = data?.reminders ?? [];

  const daysOccurrences = useMemo(
    () => occurrences.filter((item) => item.occurrence_date === selected),
    [occurrences, selected],
  );

  const upcoming = useMemo(() => {
    const t = today();
    return occurrences
      .filter((item) => item.occurrence_date >= t && !item.is_completed)
      .slice(0, 12);
  }, [occurrences]);

  const pendingToday = daysOccurrences.filter((item) => !item.is_completed).length;

  async function save() {
    if (!draft) return;
    if (!draft.title.trim()) {
      push("Give the reminder a title.", "error");
      return;
    }

    setSaving(true);
    try {
      if (draft.id) {
        await api.patch(`/api/reminders/${draft.id}`, draft);
        push("Reminder updated.");
      } else {
        await api.post("/api/reminders", draft);
        push("Reminder added.");
      }
      setDraft(null);
      await reload();
    } catch (caught) {
      push(caught instanceof Error ? caught.message : "Couldn't save.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function toggle(occurrence: ReminderOccurrence) {
    try {
      await api.post(`/api/reminders/${occurrence.id}/complete`, {
        date: occurrence.occurrence_date,
        completed: !occurrence.is_completed,
      });
      await reload();
    } catch {
      push("Couldn't update that reminder.", "error");
    }
  }

  async function remove(reminder: Reminder) {
    try {
      await api.delete(`/api/reminders/${reminder.id}`);
      push("Reminder deleted.");
      await reload();
    } catch {
      push("Couldn't delete that reminder.", "error");
    }
  }

  function editFrom(occurrence: ReminderOccurrence | Reminder) {
    setDraft({
      id: occurrence.id,
      title: occurrence.title,
      description: occurrence.description,
      date: occurrence.date,
      time: occurrence.time,
      priority: occurrence.priority,
      repeat_rule: occurrence.repeat_rule,
    });
  }

  return (
    <Page
      title="Reminders"
      subtitle={`${reminders.length} reminders - ${pendingToday} still open on ${formatDate(selected, { month: "short", day: "numeric" })}`}
      actions={
        <>
          <Segmented
            value={view}
            onChange={setView}
            size="sm"
            options={[
              {
                value: "table",
                label: (
                  <span className="flex items-center gap-1.5">
                    <Table2 className="size-3.5" />
                    Day table
                  </span>
                ),
              },
              {
                value: "list",
                label: (
                  <span className="flex items-center gap-1.5">
                    <Bell className="size-3.5" />
                    All
                  </span>
                ),
              },
            ]}
          />
          <Button
            variant="primary"
            size="sm"
            onClick={() => setDraft(emptyDraft(selected))}
          >
            <Plus className="size-4" />
            New reminder
          </Button>
        </>
      }
    >
      {error && (
        <Callout tone="danger" className="mb-4">
          {error}
        </Callout>
      )}

      {/* min-w-0 keeps the all-reminders table inside its scroll container. */}
      <div className="grid gap-4 lg:grid-cols-[19rem_1fr]">
        {/* Calendar + upcoming */}
        <div className="min-w-0 space-y-4">
          <Card>
            <CardHeader
              title={monthLabel(month)}
              icon={<CalendarDays className="size-4" />}
              action={
                <>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setMonth(addMonths(month, -1))}
                    aria-label="Previous month"
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setMonth(addMonths(month, 1))}
                    aria-label="Next month"
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </>
              }
            />
            <CardBody>
              {loading && !data ? (
                <Skeleton className="h-64" />
              ) : (
                <MonthCalendar
                  month={month}
                  selected={selected}
                  occurrences={occurrences}
                  onSelect={setSelected}
                />
              )}
              <div className="border-line mt-3 flex flex-wrap gap-x-3 gap-y-1 border-t pt-3 text-[11.5px]">
                {(["high", "medium", "low"] as Priority[]).map((priority) => (
                  <span key={priority} className="flex items-center gap-1.5">
                    <span
                      className="size-1.5 rounded-full"
                      style={{ background: PRIORITY_COLOR[priority] }}
                    />
                    <span className="text-ink-3">{priority}</span>
                  </span>
                ))}
                <span className="flex items-center gap-1.5">
                  <span
                    className="size-1.5 rounded-full"
                    style={{ background: "var(--good)" }}
                  />
                  <span className="text-ink-3">all done</span>
                </span>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Coming up"
              icon={<BellRing className="size-4" />}
              subtitle="Next open reminders"
            />
            <CardBody>
              {upcoming.length === 0 ? (
                <p className="text-ink-3 text-[13px]">
                  Nothing open. Everything scheduled is ticked off.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {upcoming.map((item) => (
                    <li
                      key={`${item.id}-${item.occurrence_date}`}
                      className="flex items-start gap-2"
                    >
                      <span
                        aria-hidden
                        className="mt-1.5 size-1.5 shrink-0 rounded-full"
                        style={{ background: PRIORITY_COLOR[item.priority] }}
                      />
                      <button
                        onClick={() => {
                          setSelected(item.occurrence_date);
                          setMonth(startOfMonth(item.occurrence_date));
                        }}
                        className="min-w-0 flex-1 text-left"
                      >
                        <span className="text-ink block truncate text-[13px]">
                          {item.title}
                        </span>
                        <span className="text-ink-3 text-[11.5px]">
                          {formatDate(item.occurrence_date, {
                            month: "short",
                            day: "numeric",
                          })}{" "}
                          at {formatTime(item.time)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Day table or full list */}
        <Card className="min-w-0">
          <CardHeader
            title={
              view === "table"
                ? formatDate(selected)
                : `All reminders (${reminders.length})`
            }
            subtitle={
              view === "table"
                ? "Every hour of the day, so you can see where things sit"
                : "Including repeats and completed one-offs"
            }
            action={
              view === "table" && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setDraft(emptyDraft(selected))}
                >
                  <Plus className="size-3.5" />
                  Add
                </Button>
              )
            }
          />
          <CardBody>
            {loading && !data ? (
              <Skeleton className="h-96" />
            ) : view === "table" ? (
              <HourTable
                occurrences={daysOccurrences}
                onToggle={toggle}
                onEdit={editFrom}
                onAdd={(time) => setDraft({ ...emptyDraft(selected), time })}
              />
            ) : reminders.length === 0 ? (
              <EmptyState
                icon={<Bell className="size-5" />}
                title="No reminders yet"
                message="Add the things you need to remember and they'll appear on the calendar."
                action={
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setDraft(emptyDraft(selected))}
                  >
                    <Plus className="size-4" />
                    New reminder
                  </Button>
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[38rem] border-collapse text-left">
                  <thead>
                    <tr className="border-line border-b">
                      {["Reminder", "When", "Repeat", "Priority", ""].map(
                        (heading) => (
                          <th
                            key={heading}
                            className="text-ink-3 py-2 pr-3 text-[11.5px] font-medium"
                          >
                            {heading}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {reminders.map((reminder) => (
                      <tr
                        key={reminder.id}
                        className="border-line group border-b last:border-b-0"
                      >
                        <td className="py-2.5 pr-3">
                          <p className="text-ink text-[13.5px]">
                            {reminder.title}
                          </p>
                          {reminder.description && (
                            <p className="text-ink-3 mt-0.5 text-[12px]">
                              {reminder.description}
                            </p>
                          )}
                        </td>
                        <td className="text-ink-2 py-2.5 pr-3 text-[12.5px] whitespace-nowrap">
                          {formatDate(reminder.date, {
                            month: "short",
                            day: "numeric",
                          })}
                          <span className="text-ink-3">
                            {" "}
                            {formatTime(reminder.time)}
                          </span>
                        </td>
                        <td className="py-2.5 pr-3">
                          {reminder.repeat_rule === "none" ? (
                            <span className="text-ink-3 text-[12px]">Once</span>
                          ) : (
                            <Badge color="var(--series-7)">
                              <Repeat className="size-3" />
                              {reminder.repeat_rule}
                            </Badge>
                          )}
                        </td>
                        <td className="py-2.5 pr-3">
                          <PriorityBadge priority={reminder.priority} />
                        </td>
                        <td className="py-2.5">
                          <div className="flex justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Edit"
                              onClick={() => editFrom(reminder)}
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Delete"
                              onClick={() => setDeleting(reminder)}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <Modal
        open={draft !== null}
        onClose={() => setDraft(null)}
        title={draft?.id ? "Edit reminder" : "New reminder"}
        footer={
          <>
            {draft?.id && (
              <Button
                variant="ghost"
                className="mr-auto"
                onClick={() => {
                  const target = reminders.find((item) => item.id === draft.id);
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
              {draft?.id ? "Save changes" : "Add reminder"}
            </Button>
          </>
        }
      >
        {draft && (
          <div className="space-y-4">
            <Input
              label="Title"
              value={draft.title}
              onChange={(event) =>
                setDraft({ ...draft, title: event.target.value })
              }
              placeholder="Submit assignment"
              autoFocus
            />

            <Textarea
              label="Description"
              hint="Optional"
              rows={2}
              value={draft.description}
              onChange={(event) =>
                setDraft({ ...draft, description: event.target.value })
              }
              placeholder="Anything you'll want to see when it fires"
            />

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Date"
                type="date"
                value={draft.date}
                onChange={(event) =>
                  setDraft({ ...draft, date: event.target.value })
                }
              />
              <Input
                label="Time"
                type="time"
                value={draft.time}
                onChange={(event) =>
                  setDraft({ ...draft, time: event.target.value })
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Priority"
                value={draft.priority}
                onChange={(event) =>
                  setDraft({ ...draft, priority: event.target.value as Priority })
                }
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </Select>

              <Select
                label="Repeat"
                value={draft.repeat_rule}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    repeat_rule: event.target.value as RepeatRule,
                  })
                }
              >
                <option value="none">Doesn&apos;t repeat</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </Select>
            </div>

            {draft.repeat_rule !== "none" && (
              <Callout tone="info">
                Repeating reminders are ticked off per day, so completing
                today&apos;s doesn&apos;t clear tomorrow&apos;s.
              </Callout>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && remove(deleting)}
        title="Delete reminder?"
        message={
          <>
            <strong className="text-ink">{deleting?.title}</strong> and every
            repeat of it will be removed.
          </>
        }
      />
    </Page>
  );
}
