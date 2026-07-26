import {
  body,
  dateStr,
  fail,
  json,
  oneOf,
  str,
  timeStr,
  withUser,
} from "@/lib/api";
import { applyUpdates, deleteRow, pick } from "@/lib/crud";
import { today } from "@/lib/utils";

type Ctx = { params: Promise<{ id: string }> };

const PRIORITIES = ["low", "medium", "high"] as const;
const REPEATS = ["none", "daily", "weekly", "monthly"] as const;

export const PATCH = withUser<Ctx>(async (user, request, { params }) => {
  const { id } = await params;
  const input = await body<Record<string, unknown>>(request);

  const updates = pick(input, {
    title: (v) => str(v),
    description: (v) => str(v),
    date: (v) => dateStr(v, today()),
    time: (v) => timeStr(v, "09:00"),
    priority: (v) => oneOf(v, PRIORITIES, "medium"),
    repeat_rule: (v) => oneOf(v, REPEATS, "none"),
    completed: (v) => (v ? 1 : 0),
  });

  if ("title" in updates && !updates.title) {
    return fail("Give the reminder a title.");
  }

  const changed = await applyUpdates("reminders", id, user.id, updates);
  if (changed === 0) return fail("Reminder not found.", 404);

  return json({ ok: true });
});

export const DELETE = withUser<Ctx>(async (user, _request, { params }) => {
  const { id } = await params;
  if ((await deleteRow("reminders", id, user.id)) === 0) {
    return fail("Reminder not found.", 404);
  }
  return json({ ok: true });
});
