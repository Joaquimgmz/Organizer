import { body, fail, json, num, str, withUser } from "@/lib/api";
import { get, run } from "@/lib/db";
import { uid } from "@/lib/utils";

type Ctx = { params: Promise<{ id: string }> };

export const POST = withUser<Ctx>(async (user, request, { params }) => {
  const { id: sessionId } = await params;
  const input = await body<Record<string, unknown>>(request);

  const session = get<{ id: string }>(
    `SELECT id FROM workout_sessions WHERE id = ? AND user_id = ?`,
    sessionId,
    user.id,
  );
  if (!session) return fail("Workout not found.", 404);

  const name = str(input.name);
  if (!name) return fail("Name the exercise.");

  const next = get<{ next: number }>(
    `SELECT COALESCE(MAX(position) + 1, 0) AS next FROM workout_exercises WHERE session_id = ?`,
    sessionId,
  );

  const id = uid("x_");
  run(
    `INSERT INTO workout_exercises
       (id, session_id, user_id, name, sets, reps, weight, rest_seconds, completed, position)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    id,
    sessionId,
    user.id,
    name,
    Math.max(1, Math.round(num(input.sets, 3))),
    Math.max(1, Math.round(num(input.reps, 10))),
    Math.max(0, num(input.weight, 0)),
    Math.max(0, Math.round(num(input.rest_seconds, 90))),
    next?.next ?? 0,
  );

  return json({ id }, 201);
});
