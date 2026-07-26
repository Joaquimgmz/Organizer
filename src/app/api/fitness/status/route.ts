import { json, query, withUser } from "@/lib/api";
import { all } from "@/lib/db";
import {
  getConnection,
  isConfigured,
  providerConfig,
  redirectUri,
} from "@/lib/fitness";
import type { FitnessDay, FitnessProvider } from "@/lib/types";
import { addDays, today } from "@/lib/utils";

const PROVIDERS: FitnessProvider[] = ["fitbit", "google"];

export const GET = withUser(async (user, request) => {
  const days = Math.min(90, Math.max(7, Number(query(request).get("days")) || 14));
  const since = addDays(today(), -(days - 1));

  const providers = PROVIDERS.map((provider) => {
    const config = providerConfig(provider);
    const connection = getConnection(user.id, provider);

    return {
      provider,
      label: config.label,
      note: config.note,
      scope: config.scope,
      configured: isConfigured(provider),
      connected: Boolean(connection),
      demo: connection?.demo === 1,
      expires_at: connection?.expires_at ?? null,
      redirect_uri: redirectUri(provider),
    };
  });

  const daily = all<FitnessDay>(
    `SELECT date, provider, steps, calories, distance_km, active_minutes, resting_hr, workout_count
       FROM fitness_daily WHERE user_id = ? AND date >= ? ORDER BY date`,
    user.id,
    since,
  );

  const latest = daily.length > 0 ? daily[daily.length - 1] : null;

  const totals = daily.reduce(
    (acc, day) => ({
      steps: acc.steps + day.steps,
      calories: acc.calories + day.calories,
      distance_km: acc.distance_km + day.distance_km,
      active_minutes: acc.active_minutes + day.active_minutes,
    }),
    { steps: 0, calories: 0, distance_km: 0, active_minutes: 0 },
  );

  return json({
    providers,
    daily,
    latest,
    totals,
    averages:
      daily.length > 0
        ? {
            steps: Math.round(totals.steps / daily.length),
            calories: Math.round(totals.calories / daily.length),
            active_minutes: Math.round(totals.active_minutes / daily.length),
          }
        : null,
  });
});
