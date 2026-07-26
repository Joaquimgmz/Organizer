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
import { ACTIVITY_CATEGORIES } from "@/lib/types";
import { today } from "@/lib/utils";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = withUser<Ctx>(async (user, request, { params }) => {
  const { id } = await params;
  const input = await body<Record<string, unknown>>(request);

  const updates = pick(input, {
    title: (v) => str(v),
    category: (v) => oneOf(v, ACTIVITY_CATEGORIES, "personal"),
    start_time: (v) => timeStr(v, "09:00"),
    end_time: (v) => timeStr(v, "10:00"),
    notes: (v) => str(v),
    date: (v) => dateStr(v, today()),
    completed: (v) => (v ? 1 : 0),
  });

  if ("title" in updates && !updates.title) {
    return fail("Give the activity a name.");
  }
  if (
    typeof updates.start_time === "string" &&
    typeof updates.end_time === "string" &&
    updates.end_time <= updates.start_time
  ) {
    return fail("The end time has to be after the start time.");
  }

  const changed = applyUpdates("activities", id, user.id, updates);
  if (changed === 0) return fail("Activity not found.", 404);

  return json({ ok: true });
});

export const DELETE = withUser<Ctx>(async (user, _request, { params }) => {
  const { id } = await params;
  if (deleteRow("activities", id, user.id) === 0) {
    return fail("Activity not found.", 404);
  }
  return json({ ok: true });
});
