import { NextResponse } from "next/server";
import { currentUser } from "./auth";
import type { User } from "./types";

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Wrap a route handler so it only runs for a signed-in user, and so thrown
 * errors turn into a clean JSON response instead of an HTML error page.
 */
export function withUser<C = unknown>(
  handler: (user: User, request: Request, context: C) => Promise<Response>,
) {
  return async (request: Request, context: C): Promise<Response> => {
    try {
      const user = await currentUser();
      if (!user) return fail("Not signed in", 401);
      return await handler(user, request, context);
    } catch (error) {
      console.error("[api]", error);
      const message =
        error instanceof Error ? error.message : "Something went wrong";
      return fail(message, 500);
    }
  };
}

export async function body<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    return {} as T;
  }
}

export function query(request: Request) {
  return new URL(request.url).searchParams;
}

/** Coerce to a finite number, falling back when the input is junk. */
export function num(value: unknown, fallback = 0): number {
  const n = typeof value === "string" ? Number(value) : (value as number);
  return Number.isFinite(n) ? n : fallback;
}

export function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

/** Validate a value against a whitelist, falling back to the first entry. */
export function oneOf<T extends readonly string[]>(
  value: unknown,
  allowed: T,
  fallback: T[number] = allowed[0],
): T[number] {
  return typeof value === "string" && allowed.includes(value)
    ? (value as T[number])
    : fallback;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

export function dateStr(value: unknown, fallback: string): string {
  return typeof value === "string" && DATE_RE.test(value) ? value : fallback;
}

export function timeStr(value: unknown, fallback: string): string {
  return typeof value === "string" && TIME_RE.test(value) ? value : fallback;
}
