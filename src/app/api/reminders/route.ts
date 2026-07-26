import {
  body,
  dateStr,
  fail,
  json,
  oneOf,
  query,
  str,
  timeStr,
  withUser,
} from "@/lib/api";
import { all, run } from "@/lib/db";
import type { Reminder } from "@/lib/types";
import { expandReminders, nowIso, today, uid } from "@/lib/utils";

const PRIORITIES = ["low", "medium", "high"] as const;
const REPEATS = ["none", "daily", "weekly", "monthly"] as const;

type Row = Reminder & { completions: string | null };

async function loadReminders(userId: string): Promise<Reminder[]> {
  const rows = await all<Row>(
    `SELECT r.*, (
       SELECT group_concat(date) FROM reminder_completions c WHERE c.reminder_id = r.id
     ) AS completions
     FROM reminders r WHERE r.user_id = ? ORDER BY r.date, r.time`,
    userId,
  );
  return rows.map((row) => ({
    ...row,
    completions: row.completions ? row.completions.split(",") : [],
  }));
}

/**
 * GET /api/reminders
 *   ?from=&to=   → occurrences expanded across the range (for calendar/table)
 *   (no range)   → the raw stored reminders (for the management list)
 */
export const GET = withUser(async (user, request) => {
  const params = query(request);
  const reminders = await loadReminders(user.id);

  const from = params.get("from");
  if (!from) return json({ reminders });

  const start = dateStr(from, today());
  const end = dateStr(params.get("to"), start);

  return json({
    reminders,
    occurrences: expandReminders(reminders, start, end),
  });
});

export const POST = withUser(async (user, request) => {
  const input = await body<Record<string, unknown>>(request);

  const title = str(input.title);
  if (!title) return fail("Give the reminder a title.");

  const id = uid("r_");
  await run(
    `INSERT INTO reminders (id, user_id, date, time, title, description, priority, repeat_rule, completed, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    id,
    user.id,
    dateStr(input.date, today()),
    timeStr(input.time, "09:00"),
    title,
    str(input.description),
    oneOf(input.priority, PRIORITIES, "medium"),
    oneOf(input.repeat_rule, REPEATS, "none"),
    nowIso(),
  );

  return json({ id }, 201);
});
