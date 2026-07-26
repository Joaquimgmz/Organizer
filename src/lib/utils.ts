import type { Reminder, ReminderOccurrence, RepeatRule } from "./types";

/** Tiny classname joiner — avoids pulling in clsx. */
export function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

export function uid(prefix = "") {
  return (
    prefix +
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 10)
  );
}

export function nowIso() {
  return new Date().toISOString();
}

// ── Dates ────────────────────────────────────────────────────────────────────
// Everything is stored as a local-time YYYY-MM-DD string so a day never shifts
// under the user because of a UTC conversion.

export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function today(): string {
  return toDateKey(new Date());
}

export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key: string, days: number): string {
  const d = fromDateKey(key);
  d.setDate(d.getDate() + days);
  return toDateKey(d);
}

export function addMonths(key: string, months: number): string {
  const d = fromDateKey(key);
  d.setMonth(d.getMonth() + months);
  return toDateKey(d);
}

export function startOfMonth(key: string): string {
  const d = fromDateKey(key);
  return toDateKey(new Date(d.getFullYear(), d.getMonth(), 1));
}

export function endOfMonth(key: string): string {
  const d = fromDateKey(key);
  return toDateKey(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

export function daysInMonth(key: string): number {
  const d = fromDateKey(key);
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

export function formatDate(
  key: string,
  opts: Intl.DateTimeFormatOptions = {
    weekday: "long",
    month: "long",
    day: "numeric",
  },
) {
  return fromDateKey(key).toLocaleDateString(undefined, opts);
}

export function formatShortDate(key: string) {
  return fromDateKey(key).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function relativeDay(key: string): string {
  const t = today();
  if (key === t) return "Today";
  if (key === addDays(t, 1)) return "Tomorrow";
  if (key === addDays(t, -1)) return "Yesterday";
  return formatDate(key, { weekday: "short", month: "short", day: "numeric" });
}

export function monthLabel(key: string) {
  return fromDateKey(key).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

/** Convert "HH:MM" to minutes since midnight. */
export function minutesOf(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + (m || 0);
}

export function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m || 0, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function durationLabel(start: string, end: string): string {
  const mins = Math.max(0, minutesOf(end) - minutesOf(start));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

// ── Money ────────────────────────────────────────────────────────────────────

export function formatMoney(amount: number, currency = "USD") {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export function formatCompact(n: number) {
  return new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
}

// ── Reminder recurrence ──────────────────────────────────────────────────────

function matchesRule(
  rule: RepeatRule,
  startKey: string,
  candidate: string,
): boolean {
  if (candidate < startKey) return false;
  if (rule === "none") return candidate === startKey;
  if (rule === "daily") return true;

  const start = fromDateKey(startKey);
  const day = fromDateKey(candidate);

  if (rule === "weekly") return start.getDay() === day.getDay();

  // Monthly: same day-of-month, clamped so the 31st still fires in short months.
  const lastDay = new Date(
    day.getFullYear(),
    day.getMonth() + 1,
    0,
  ).getDate();
  const target = Math.min(start.getDate(), lastDay);
  return day.getDate() === target;
}

/**
 * Expand stored reminders into concrete occurrences between two dates
 * (inclusive). Repeating reminders track completion per occurrence.
 */
export function expandReminders(
  reminders: Reminder[],
  fromKey: string,
  toKey: string,
): ReminderOccurrence[] {
  const out: ReminderOccurrence[] = [];

  for (let cursor = fromKey; cursor <= toKey; cursor = addDays(cursor, 1)) {
    for (const reminder of reminders) {
      if (!matchesRule(reminder.repeat_rule, reminder.date, cursor)) continue;

      const isCompleted =
        reminder.repeat_rule === "none"
          ? reminder.completed === 1
          : (reminder.completions ?? []).includes(cursor);

      out.push({
        ...reminder,
        occurrence_date: cursor,
        is_completed: isCompleted,
      });
    }
  }

  return out.sort((a, b) =>
    a.occurrence_date === b.occurrence_date
      ? a.time.localeCompare(b.time)
      : a.occurrence_date.localeCompare(b.occurrence_date),
  );
}

// ── Misc ─────────────────────────────────────────────────────────────────────

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function sum(values: number[]) {
  return values.reduce((a, b) => a + b, 0);
}

export function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
