import { body, dateStr, fail, json, num, str, withUser } from "@/lib/api";
import { applyUpdates, deleteRow, pick } from "@/lib/crud";
import { clamp, nowIso, today } from "@/lib/utils";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = withUser<Ctx>(async (user, request, { params }) => {
  const { id } = await params;
  const input = await body<Record<string, unknown>>(request);

  const updates = pick(input, {
    title: (v) => str(v),
    content: (v) => str(v),
    date: (v) => dateStr(v, today()),
    mood: (v) => clamp(Math.round(num(v, 3)), 1, 5),
    tags: (v) =>
      JSON.stringify(
        Array.isArray(v)
          ? [
              ...new Set(
                v
                  .filter((tag): tag is string => typeof tag === "string")
                  .map((tag) => tag.trim().toLowerCase())
                  .filter(Boolean),
              ),
            ].slice(0, 12)
          : [],
      ),
  });

  if ("content" in updates && !updates.content) {
    return fail("The entry can't be empty.");
  }

  const changed = await applyUpdates("diary_entries", id, user.id, {
    ...updates,
    updated_at: nowIso(),
  });
  if (changed === 0) return fail("Entry not found.", 404);

  return json({ ok: true });
});

export const DELETE = withUser<Ctx>(async (user, _request, { params }) => {
  const { id } = await params;
  if ((await deleteRow("diary_entries", id, user.id)) === 0) {
    return fail("Entry not found.", 404);
  }
  return json({ ok: true });
});
