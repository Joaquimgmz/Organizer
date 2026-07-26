import { fail, json, withUser } from "@/lib/api";
import { deleteRow } from "@/lib/crud";

type Ctx = { params: Promise<{ id: string }> };

export const DELETE = withUser<Ctx>(async (user, _request, { params }) => {
  const { id } = await params;
  if (deleteRow("workout_templates", id, user.id) === 0) {
    return fail("Template not found.", 404);
  }
  return json({ ok: true });
});
