import { body, fail, json, num, str, withUser } from "@/lib/api";
import { applyUpdates, deleteRow, pick } from "@/lib/crud";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = withUser<Ctx>(async (user, request, { params }) => {
  const { id } = await params;
  const input = await body<Record<string, unknown>>(request);

  const updates = pick(input, {
    name: (v) => str(v) || "Exercise",
    sets: (v) => Math.max(1, Math.round(num(v, 3))),
    reps: (v) => Math.max(1, Math.round(num(v, 10))),
    weight: (v) => Math.max(0, num(v, 0)),
    rest_seconds: (v) => Math.max(0, Math.round(num(v, 90))),
    completed: (v) => (v ? 1 : 0),
    position: (v) => Math.max(0, Math.round(num(v, 0))),
  });

  const changed = applyUpdates("workout_exercises", id, user.id, updates);
  if (changed === 0) return fail("Exercise not found.", 404);

  return json({ ok: true });
});

export const DELETE = withUser<Ctx>(async (user, _request, { params }) => {
  const { id } = await params;
  if (deleteRow("workout_exercises", id, user.id) === 0) {
    return fail("Exercise not found.", 404);
  }
  return json({ ok: true });
});
