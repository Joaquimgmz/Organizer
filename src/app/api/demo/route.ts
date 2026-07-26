import { body, json, withUser } from "@/lib/api";
import { clearUserData, seedDemoData } from "@/lib/demo";

/**
 * Reset the account's data.
 *   { reseed: true }  → wipe, then load the example month again
 *   { reseed: false } → wipe only, leaving a blank account
 */
export const POST = withUser(async (user, request) => {
  const input = await body<{ reseed?: boolean }>(request);

  clearUserData(user.id);
  if (input.reseed !== false) seedDemoData(user.id);

  return json({ ok: true, reseeded: input.reseed !== false });
});
