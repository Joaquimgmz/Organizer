import crypto from "node:crypto";
import { get, run } from "./db";
import type { FitnessProvider } from "./types";
import { addDays, nowIso, today, uid } from "./utils";

/**
 * OAuth 2.0 + data sync for Fitbit and Google Fit.
 *
 * Fitbit is the better-supported target today; Google is retiring the Fit REST
 * API in favour of Health Connect, so treat the Google path as legacy.
 *
 * When a provider has no client credentials configured, the UI offers a demo
 * connection instead: it writes plausible generated data so the screen and the
 * sync flow can be exercised end to end. Demo rows are flagged in the database
 * and labelled in the UI — they are never presented as real measurements.
 */

export type ProviderConfig = {
  id: FitnessProvider;
  label: string;
  clientId?: string;
  clientSecret?: string;
  authorizeUrl: string;
  tokenUrl: string;
  scope: string;
  usesPkce: boolean;
  note: string;
};

export function appUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    "http://localhost:3000"
  );
}

export function redirectUri(provider: FitnessProvider): string {
  return `${appUrl()}/api/fitness/callback/${provider}`;
}

export function providerConfig(provider: FitnessProvider): ProviderConfig {
  if (provider === "fitbit") {
    return {
      id: "fitbit",
      label: "Fitbit",
      clientId: process.env.FITBIT_CLIENT_ID,
      clientSecret: process.env.FITBIT_CLIENT_SECRET,
      authorizeUrl: "https://www.fitbit.com/oauth2/authorize",
      tokenUrl: "https://api.fitbit.com/oauth2/token",
      scope: "activity heartrate profile",
      usesPkce: true,
      note: "Steps, calories, distance, active minutes, resting heart rate and workout sessions.",
    };
  }

  return {
    id: "google",
    label: "Google Fit",
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scope: [
      "https://www.googleapis.com/auth/fitness.activity.read",
      "https://www.googleapis.com/auth/fitness.location.read",
      "https://www.googleapis.com/auth/fitness.heart_rate.read",
    ].join(" "),
    usesPkce: false,
    note: "Steps, calories, distance, active minutes and heart rate. Google is migrating this API to Health Connect.",
  };
}

export function isConfigured(provider: FitnessProvider): boolean {
  const config = providerConfig(provider);
  return Boolean(config.clientId && config.clientSecret);
}

// ── Authorisation ────────────────────────────────────────────────────────────

export async function buildAuthorizeUrl(
  provider: FitnessProvider,
  userId: string,
): Promise<string> {
  const config = providerConfig(provider);
  const state = crypto.randomBytes(16).toString("hex");

  let codeVerifier = "";
  const params = new URLSearchParams({
    client_id: config.clientId!,
    response_type: "code",
    redirect_uri: redirectUri(provider),
    scope: config.scope,
    state,
  });

  if (config.usesPkce) {
    codeVerifier = crypto.randomBytes(48).toString("base64url");
    params.set(
      "code_challenge",
      crypto.createHash("sha256").update(codeVerifier).digest("base64url"),
    );
    params.set("code_challenge_method", "S256");
  } else {
    params.set("access_type", "offline");
    params.set("prompt", "consent");
    params.set("include_granted_scopes", "true");
  }

  await run(
    `INSERT INTO oauth_states (state, user_id, provider, code_verifier, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    state,
    userId,
    provider,
    codeVerifier,
    nowIso(),
  );

  return `${config.authorizeUrl}?${params}`;
}

export async function consumeState(state: string, provider: FitnessProvider) {
  const row = await get<{
    user_id: string;
    code_verifier: string;
    created_at: string;
  }>(
    `SELECT user_id, code_verifier, created_at FROM oauth_states
      WHERE state = ? AND provider = ?`,
    state,
    provider,
  );
  if (!row) return null;

  await run(`DELETE FROM oauth_states WHERE state = ?`, state);

  // 10-minute window for the round trip.
  if (Date.now() - new Date(row.created_at).getTime() > 600_000) return null;

  return row;
}

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
};

export async function exchangeCode(
  provider: FitnessProvider,
  code: string,
  codeVerifier: string,
): Promise<TokenResponse> {
  const config = providerConfig(provider);

  const form = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri(provider),
  });

  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
  };

  if (provider === "fitbit") {
    form.set("client_id", config.clientId!);
    if (codeVerifier) form.set("code_verifier", codeVerifier);
    headers.Authorization = `Basic ${Buffer.from(
      `${config.clientId}:${config.clientSecret}`,
    ).toString("base64")}`;
  } else {
    form.set("client_id", config.clientId!);
    form.set("client_secret", config.clientSecret!);
  }

  const response = await fetch(config.tokenUrl, {
    method: "POST",
    headers,
    body: form,
  });

  if (!response.ok) {
    throw new Error(
      `${config.label} token exchange failed (${response.status}): ${await response.text()}`,
    );
  }

  return (await response.json()) as TokenResponse;
}

export async function saveConnection(
  userId: string,
  provider: FitnessProvider,
  token: TokenResponse,
  demo = false,
) {
  const expiresAt = new Date(
    Date.now() + (token.expires_in ?? 28_800) * 1000,
  ).toISOString();

  await run(
    `INSERT INTO fitness_connections
       (id, user_id, provider, access_token, refresh_token, expires_at, scope, demo, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, provider) DO UPDATE SET
       access_token  = excluded.access_token,
       refresh_token = excluded.refresh_token,
       expires_at    = excluded.expires_at,
       scope         = excluded.scope,
       demo          = excluded.demo`,
    uid("c_"),
    userId,
    provider,
    token.access_token,
    token.refresh_token ?? "",
    expiresAt,
    token.scope ?? "",
    demo ? 1 : 0,
    nowIso(),
  );
}

type Connection = {
  access_token: string;
  refresh_token: string;
  expires_at: string;
  demo: number;
};

export async function getConnection(
  userId: string,
  provider: FitnessProvider,
): Promise<Connection | undefined> {
  return get<Connection>(
    `SELECT access_token, refresh_token, expires_at, demo
       FROM fitness_connections WHERE user_id = ? AND provider = ?`,
    userId,
    provider,
  );
}

/** Refresh an expired access token, transparently updating the stored row. */
async function freshToken(
  userId: string,
  provider: FitnessProvider,
  connection: Connection,
): Promise<string> {
  if (new Date(connection.expires_at).getTime() > Date.now() + 60_000) {
    return connection.access_token;
  }
  if (!connection.refresh_token) {
    throw new Error(
      "The access token expired and no refresh token is stored. Reconnect the provider.",
    );
  }

  const config = providerConfig(provider);
  const form = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: connection.refresh_token,
  });
  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
  };

  if (provider === "fitbit") {
    headers.Authorization = `Basic ${Buffer.from(
      `${config.clientId}:${config.clientSecret}`,
    ).toString("base64")}`;
  } else {
    form.set("client_id", config.clientId!);
    form.set("client_secret", config.clientSecret!);
  }

  const response = await fetch(config.tokenUrl, {
    method: "POST",
    headers,
    body: form,
  });
  if (!response.ok) {
    throw new Error(
      `${config.label} token refresh failed (${response.status}): ${await response.text()}`,
    );
  }

  const token = (await response.json()) as TokenResponse;
  await saveConnection(userId, provider, {
    ...token,
    refresh_token: token.refresh_token ?? connection.refresh_token,
  });
  return token.access_token;
}

// ── Data sync ────────────────────────────────────────────────────────────────

export type DayMetrics = {
  date: string;
  steps: number;
  calories: number;
  distance_km: number;
  active_minutes: number;
  resting_hr: number | null;
  workout_count: number;
};

async function fitbitDay(token: string, date: string): Promise<DayMetrics> {
  const headers = { Authorization: `Bearer ${token}` };

  const [activityRes, heartRes] = await Promise.all([
    fetch(`https://api.fitbit.com/1/user/-/activities/date/${date}.json`, {
      headers,
    }),
    fetch(
      `https://api.fitbit.com/1/user/-/activities/heart/date/${date}/1d.json`,
      { headers },
    ),
  ]);

  if (!activityRes.ok) {
    throw new Error(
      `Fitbit activity request failed (${activityRes.status}): ${await activityRes.text()}`,
    );
  }

  const activity = (await activityRes.json()) as {
    summary?: {
      steps?: number;
      caloriesOut?: number;
      veryActiveMinutes?: number;
      fairlyActiveMinutes?: number;
      distances?: { activity: string; distance: number }[];
    };
    activities?: unknown[];
  };

  let restingHr: number | null = null;
  if (heartRes.ok) {
    const heart = (await heartRes.json()) as {
      "activities-heart"?: { value?: { restingHeartRate?: number } }[];
    };
    restingHr =
      heart["activities-heart"]?.[0]?.value?.restingHeartRate ?? null;
  }

  const summary = activity.summary ?? {};
  const total = summary.distances?.find((d) => d.activity === "total");

  return {
    date,
    steps: Math.round(summary.steps ?? 0),
    calories: Math.round(summary.caloriesOut ?? 0),
    distance_km: Number((total?.distance ?? 0).toFixed(2)),
    active_minutes:
      (summary.veryActiveMinutes ?? 0) + (summary.fairlyActiveMinutes ?? 0),
    resting_hr: restingHr,
    workout_count: activity.activities?.length ?? 0,
  };
}

async function googleRange(
  token: string,
  from: string,
  to: string,
): Promise<DayMetrics[]> {
  const start = new Date(`${from}T00:00:00`).getTime();
  const end = new Date(`${to}T23:59:59`).getTime();

  const response = await fetch(
    "https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        aggregateBy: [
          { dataTypeName: "com.google.step_count.delta" },
          { dataTypeName: "com.google.calories.expended" },
          { dataTypeName: "com.google.distance.delta" },
          { dataTypeName: "com.google.active_minutes" },
          { dataTypeName: "com.google.heart_rate.bpm" },
        ],
        bucketByTime: { durationMillis: 86_400_000 },
        startTimeMillis: start,
        endTimeMillis: end,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(
      `Google Fit request failed (${response.status}): ${await response.text()}`,
    );
  }

  const payload = (await response.json()) as {
    bucket?: {
      startTimeMillis: string;
      dataset?: {
        dataSourceId: string;
        point?: { value?: { intVal?: number; fpVal?: number }[] }[];
      }[];
    }[];
  };

  return (payload.bucket ?? []).map((bucket) => {
    const day = new Date(Number(bucket.startTimeMillis));
    const metrics: DayMetrics = {
      date: `${day.getFullYear()}-${`${day.getMonth() + 1}`.padStart(2, "0")}-${`${day.getDate()}`.padStart(2, "0")}`,
      steps: 0,
      calories: 0,
      distance_km: 0,
      active_minutes: 0,
      resting_hr: null,
      workout_count: 0,
    };

    for (const dataset of bucket.dataset ?? []) {
      const points = dataset.point ?? [];
      const total = points.reduce((acc, point) => {
        const value = point.value?.[0];
        return acc + (value?.intVal ?? value?.fpVal ?? 0);
      }, 0);
      if (total === 0) continue;

      const source = dataset.dataSourceId;
      if (source.includes("step_count")) metrics.steps = Math.round(total);
      else if (source.includes("calories")) metrics.calories = Math.round(total);
      else if (source.includes("distance"))
        metrics.distance_km = Number((total / 1000).toFixed(2));
      else if (source.includes("active_minutes"))
        metrics.active_minutes = Math.round(total);
      else if (source.includes("heart_rate"))
        metrics.resting_hr = Math.round(total / points.length);
    }

    return metrics;
  });
}

/** Deterministic-ish generated metrics for a demo connection. */
function demoDay(date: string, seedKey: string): DayMetrics {
  const seed = [...(date + seedKey)].reduce(
    (acc, char) => (acc * 31 + char.charCodeAt(0)) % 100_000,
    7,
  );
  const rand = (min: number, max: number, salt: number) =>
    min + ((seed * (salt + 13)) % 1000) / 1000 * (max - min);

  const weekday = new Date(`${date}T12:00:00`).getDay();
  const isWeekend = weekday === 0 || weekday === 6;

  const steps = Math.round(rand(isWeekend ? 4000 : 6500, isWeekend ? 11000 : 14500, 1));
  const activeMinutes = Math.round(rand(22, 78, 2));

  return {
    date,
    steps,
    calories: Math.round(1750 + steps * 0.042 + activeMinutes * 4.1),
    distance_km: Number((steps * 0.00075).toFixed(2)),
    active_minutes: activeMinutes,
    resting_hr: Math.round(rand(54, 66, 3)),
    workout_count: activeMinutes > 45 ? 1 : 0,
  };
}

/** Pull the last `days` days of metrics and upsert them. Returns rows written. */
export async function syncProvider(
  userId: string,
  provider: FitnessProvider,
  days = 14,
): Promise<{ synced: number; demo: boolean }> {
  const connection = await getConnection(userId, provider);
  if (!connection) throw new Error(`${provider} is not connected.`);

  const end = today();
  const start = addDays(end, -(days - 1));
  let metrics: DayMetrics[];

  if (connection.demo === 1) {
    metrics = [];
    for (let cursor = start; cursor <= end; cursor = addDays(cursor, 1)) {
      metrics.push(demoDay(cursor, userId));
    }
  } else {
    const token = await freshToken(userId, provider, connection);

    if (provider === "fitbit") {
      const dates: string[] = [];
      for (let cursor = start; cursor <= end; cursor = addDays(cursor, 1)) {
        dates.push(cursor);
      }
      // Fitbit's daily summary is one request per day; keep concurrency modest
      // so we stay well inside the 150 requests/hour rate limit.
      metrics = [];
      for (const date of dates) {
        metrics.push(await fitbitDay(token, date));
      }
    } else {
      metrics = await googleRange(token, start, end);
    }
  }

  const stamp = nowIso();
  for (const day of metrics) {
    await run(
      `INSERT INTO fitness_daily
         (id, user_id, provider, date, steps, calories, distance_km, active_minutes, resting_hr, workout_count, synced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, provider, date) DO UPDATE SET
         steps          = excluded.steps,
         calories       = excluded.calories,
         distance_km    = excluded.distance_km,
         active_minutes = excluded.active_minutes,
         resting_hr     = excluded.resting_hr,
         workout_count  = excluded.workout_count,
         synced_at      = excluded.synced_at`,
      uid("f_"),
      userId,
      provider,
      day.date,
      day.steps,
      day.calories,
      day.distance_km,
      day.active_minutes,
      day.resting_hr,
      day.workout_count,
      stamp,
    );
  }

  return { synced: metrics.length, demo: connection.demo === 1 };
}
