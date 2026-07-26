import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import {
  appUrl,
  consumeState,
  exchangeCode,
  saveConnection,
  syncProvider,
} from "@/lib/fitness";
import type { FitnessProvider } from "@/lib/types";

type Ctx = { params: Promise<{ provider: string }> };

function back(status: "connected" | "error", provider: string, detail = "") {
  const url = new URL("/fitness", appUrl());
  url.searchParams.set("status", status);
  url.searchParams.set("provider", provider);
  if (detail) url.searchParams.set("detail", detail.slice(0, 200));
  return NextResponse.redirect(url);
}

/**
 * OAuth redirect target. Verifies the `state` we issued, swaps the code for
 * tokens, does a first sync, then bounces back to the Fitness page.
 */
export async function GET(request: Request, { params }: Ctx) {
  const { provider: raw } = await params;
  const provider = (raw === "fitbit" || raw === "google"
    ? raw
    : null) as FitnessProvider | null;

  if (!provider) return back("error", raw, "Unknown provider");

  const url = new URL(request.url);
  const error = url.searchParams.get("error");
  if (error) {
    return back("error", provider, url.searchParams.get("error_description") ?? error);
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return back("error", provider, "Missing code or state");

  const pending = consumeState(state, provider);
  if (!pending) {
    return back("error", provider, "That authorisation link expired — try again");
  }

  // The signed-in user must match whoever started the flow.
  const user = await currentUser();
  if (!user || user.id !== pending.user_id) {
    return back("error", provider, "Sign in again and retry the connection");
  }

  try {
    const token = await exchangeCode(provider, code, pending.code_verifier);
    saveConnection(user.id, provider, token, false);
    await syncProvider(user.id, provider, 14);
    return back("connected", provider);
  } catch (caught) {
    console.error("[fitness] callback failed", caught);
    return back(
      "error",
      provider,
      caught instanceof Error ? caught.message : "Connection failed",
    );
  }
}
