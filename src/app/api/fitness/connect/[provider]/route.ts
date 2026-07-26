import { body, fail, json, withUser } from "@/lib/api";
import { run } from "@/lib/db";
import {
  buildAuthorizeUrl,
  isConfigured,
  providerConfig,
  saveConnection,
  syncProvider,
} from "@/lib/fitness";
import type { FitnessProvider } from "@/lib/types";

type Ctx = { params: Promise<{ provider: string }> };

function parseProvider(value: string): FitnessProvider | null {
  return value === "fitbit" || value === "google" ? value : null;
}

/**
 * Start an OAuth connection.
 *
 * Returns an authorize URL for the browser to visit — we never redirect
 * straight from a fetch() so the client can show its own error state.
 *
 * `{ demo: true }` sets up a clearly-labelled demo connection instead, which
 * generates sample metrics. That path exists so the integration is usable
 * before the user has registered a Fitbit or Google app.
 */
export const POST = withUser<Ctx>(async (user, request, { params }) => {
  const { provider: raw } = await params;
  const provider = parseProvider(raw);
  if (!provider) return fail("Unknown provider.", 404);

  const input = await body<{ demo?: boolean }>(request);

  if (input.demo) {
    saveConnection(
      user.id,
      provider,
      { access_token: "demo", refresh_token: "", expires_in: 315_360_000 },
      true,
    );
    const result = await syncProvider(user.id, provider, 14);
    return json({ mode: "demo", ...result });
  }

  if (!isConfigured(provider)) {
    const config = providerConfig(provider);
    return fail(
      `${config.label} isn't configured. Add its client ID and secret to .env.local, or connect in demo mode.`,
      400,
    );
  }

  return json({ mode: "oauth", url: buildAuthorizeUrl(provider, user.id) });
});

/** Disconnect and forget the stored tokens. */
export const DELETE = withUser<Ctx>(async (user, _request, { params }) => {
  const { provider: raw } = await params;
  const provider = parseProvider(raw);
  if (!provider) return fail("Unknown provider.", 404);

  run(
    `DELETE FROM fitness_connections WHERE user_id = ? AND provider = ?`,
    user.id,
    provider,
  );
  run(
    `DELETE FROM fitness_daily WHERE user_id = ? AND provider = ?`,
    user.id,
    provider,
  );

  return json({ ok: true });
});
