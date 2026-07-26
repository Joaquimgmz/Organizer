import { fail, json, withUser } from "@/lib/api";
import { deleteRow } from "@/lib/crud";

type Ctx = { params: Promise<{ id: string }> };

/** Remove a single contribution from a goal's history. */
export const DELETE = withUser<Ctx>(async (user, _request, { params }) => {
  const { id } = await params;
  if (deleteRow("goal_contributions", id, user.id) === 0) {
    return fail("Contribution not found.", 404);
  }
  return json({ ok: true });
});
