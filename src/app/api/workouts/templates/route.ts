import { body, fail, json, num, str, withUser } from "@/lib/api";
import { all, run } from "@/lib/db";
import type { TemplateExercise } from "@/lib/types";
import { nowIso, uid } from "@/lib/utils";

type Row = {
  id: string;
  name: string;
  muscle_group: string;
  exercises: string;
  created_at: string;
};

function cleanExercises(value: unknown): TemplateExercise[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((raw) => {
      const item = raw as Record<string, unknown>;
      return {
        name: str(item.name),
        sets: Math.max(1, Math.round(num(item.sets, 3))),
        reps: Math.max(1, Math.round(num(item.reps, 10))),
        weight: Math.max(0, num(item.weight, 0)),
        rest_seconds: Math.max(0, Math.round(num(item.rest_seconds, 90))),
      };
    })
    .filter((item) => item.name.length > 0)
    .slice(0, 30);
}

export const GET = withUser(async (user) => {
  const templates = all<Row>(
    `SELECT * FROM workout_templates WHERE user_id = ? ORDER BY name`,
    user.id,
  ).map((row) => ({
    ...row,
    exercises: JSON.parse(row.exercises || "[]") as TemplateExercise[],
  }));

  return json({ templates });
});

export const POST = withUser(async (user, request) => {
  const input = await body<Record<string, unknown>>(request);

  const name = str(input.name);
  if (!name) return fail("Give the template a name.");

  const exercises = cleanExercises(input.exercises);
  if (exercises.length === 0) return fail("Add at least one exercise.");

  const id = uid("t_");
  run(
    `INSERT INTO workout_templates (id, user_id, name, muscle_group, exercises, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    id,
    user.id,
    name,
    str(input.muscle_group) || "full body",
    JSON.stringify(exercises),
    nowIso(),
  );

  return json({ id }, 201);
});
