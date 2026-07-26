import { body, dateStr, fail, json, str, withUser } from "@/lib/api";
import { applyUpdates, deleteRow, pick } from "@/lib/crud";
import { today } from "@/lib/utils";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = withUser<Ctx>(async (user, request, { params }) => {
  const { id } = await params;
  const input = await body<Record<string, unknown>>(request);

  const updates = pick(input, {
    name: (v) => str(v),
    muscle_group: (v) => str(v) || "full body",
    notes: (v) => str(v),
    date: (v) => dateStr(v, today()),
  });

  if ("name" in updates && !updates.name) {
    return fail("Give the workout a name.");
  }

  const changed = applyUpdates("workout_sessions", id, user.id, updates);
  if (changed === 0) return fail("Workout not found.", 404);

  return json({ ok: true });
});

export const DELETE = withUser<Ctx>(async (user, _request, { params }) => {
  const { id } = await params;
  // workout_exercises cascades on delete.
  if (deleteRow("workout_sessions", id, user.id) === 0) {
    return fail("Workout not found.", 404);
  }
  return json({ ok: true });
});
