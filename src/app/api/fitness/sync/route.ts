import { body, fail, json, withUser } from "@/lib/api";
import { all } from "@/lib/db";
import { syncProvider } from "@/lib/fitness";
import type { FitnessProvider } from "@/lib/types";

export const POST = withUser(async (user, request) => {
  const input = await body<{ provider?: string; days?: number }>(request);
  const days = Math.min(60, Math.max(1, Math.round(Number(input.days) || 14)));

  const connected = all<{ provider: FitnessProvider }>(
    `SELECT provider FROM fitness_connections WHERE user_id = ?`,
    user.id,
  ).map((row) => row.provider);

  const targets =
    input.provider === "fitbit" || input.provider === "google"
      ? connected.filter((provider) => provider === input.provider)
      : connected;

  if (targets.length === 0) {
    return fail("No fitness provider is connected yet.", 400);
  }

  const results: Record<string, { synced: number; demo: boolean } | string> = {};
  let anySucceeded = false;

  for (const provider of targets) {
    try {
      results[provider] = await syncProvider(user.id, provider, days);
      anySucceeded = true;
    } catch (caught) {
      results[provider] =
        caught instanceof Error ? caught.message : "Sync failed";
    }
  }

  return json({ ok: anySucceeded, results }, anySucceeded ? 200 : 502);
});
