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
import { ACTIVITY_CATEGORIES, type Activity } from "@/lib/types";
import { nowIso, today, uid } from "@/lib/utils";

export const GET = withUser(async (user, request) => {
  const params = query(request);
  const from = dateStr(params.get("from"), today());
  const to = dateStr(params.get("to"), from);

  const activities = await all<Activity>(
    `SELECT * FROM activities WHERE user_id = ? AND date BETWEEN ? AND ?
      ORDER BY date, start_time`,
    user.id,
    from,
    to,
  );

  return json({ activities });
});

export const POST = withUser(async (user, request) => {
  const input = await body<Record<string, unknown>>(request);

  const title = str(input.title);
  if (!title) return fail("Give the activity a name.");

  const start = timeStr(input.start_time, "09:00");
  const end = timeStr(input.end_time, "10:00");
  if (end <= start) return fail("The end time has to be after the start time.");

  const id = uid("a_");
  await run(
    `INSERT INTO activities (id, user_id, date, title, category, start_time, end_time, notes, completed, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    id,
    user.id,
    dateStr(input.date, today()),
    title,
    oneOf(input.category, ACTIVITY_CATEGORIES, "personal"),
    start,
    end,
    str(input.notes),
    nowIso(),
  );

  return json({ id }, 201);
});
