import { body, dateStr, fail, json, withUser } from "@/lib/api";
import { get, run } from "@/lib/db";
import { today } from "@/lib/utils";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Toggle a reminder occurrence.
 *
 * One-off reminders store completion on the row itself. Repeating reminders
 * store it per date in reminder_completions, so ticking off today's stand-up
 * doesn't mark tomorrow's as done too.
 */
export const POST = withUser<Ctx>(async (user, request, { params }) => {
  const { id } = await params;
  const input = await body<{ date?: string; completed?: boolean }>(request);

  const reminder = get<{ repeat_rule: string }>(
    `SELECT repeat_rule FROM reminders WHERE id = ? AND user_id = ?`,
    id,
    user.id,
  );
  if (!reminder) return fail("Reminder not found.", 404);

  const date = dateStr(input.date, today());
  const completed = input.completed !== false;

  if (reminder.repeat_rule === "none") {
    run(
      `UPDATE reminders SET completed = ? WHERE id = ? AND user_id = ?`,
      completed ? 1 : 0,
      id,
      user.id,
    );
  } else if (completed) {
    run(
      `INSERT OR IGNORE INTO reminder_completions (reminder_id, date) VALUES (?, ?)`,
      id,
      date,
    );
  } else {
    run(
      `DELETE FROM reminder_completions WHERE reminder_id = ? AND date = ?`,
      id,
      date,
    );
  }

  return json({ ok: true, completed });
});
