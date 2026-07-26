import crypto from "node:crypto";
import { cookies } from "next/headers";
import { get, run } from "./db";
import type { User } from "./types";
import { nowIso, uid } from "./utils";

const COOKIE = "ro_session";
const SESSION_DAYS = 30;

function secret(): string {
  const value = process.env.AUTH_SECRET;
  if (value && value.length >= 16) return value;

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "AUTH_SECRET must be set (at least 16 characters) in production.",
    );
  }
  // Dev convenience only: stable across reloads, obviously not a secret.
  return "routine-organizer-development-secret-do-not-use-in-production";
}

// ── Passwords ────────────────────────────────────────────────────────────────
// scrypt from node:crypto — no native bcrypt dependency to compile.

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(password, salt, 64);
  return `scrypt:${salt.toString("hex")}:${derived.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, saltHex, hashHex] = stored.split(":");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;

  const expected = Buffer.from(hashHex, "hex");
  const actual = crypto.scryptSync(
    password,
    Buffer.from(saltHex, "hex"),
    expected.length,
  );
  return crypto.timingSafeEqual(expected, actual);
}

// ── Session tokens ───────────────────────────────────────────────────────────
// Random id stored in the DB (so sessions can be revoked) plus an HMAC so a
// forged cookie is rejected before it ever touches the database.

function sign(id: string): string {
  return crypto.createHmac("sha256", secret()).update(id).digest("hex");
}

function verifyToken(token: string): string | null {
  const [id, signature] = token.split(".");
  if (!id || !signature) return null;

  const expected = sign(id);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  return id;
}

export async function createSession(userId: string) {
  const id = uid("s_");
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000);

  run(
    `INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)`,
    id,
    userId,
    expires.toISOString(),
    nowIso(),
  );

  const store = await cookies();
  store.set(COOKIE, `${id}.${sign(id)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  });
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;

  if (token) {
    const id = verifyToken(token);
    if (id) run(`DELETE FROM sessions WHERE id = ?`, id);
  }

  store.delete(COOKIE);
}

/** Resolve the signed-in user, or null. Safe to call from any server context. */
export async function currentUser(): Promise<User | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;

  const id = verifyToken(token);
  if (!id) return null;

  const row = get<{ user_id: string; expires_at: string }>(
    `SELECT user_id, expires_at FROM sessions WHERE id = ?`,
    id,
  );
  if (!row) return null;

  if (new Date(row.expires_at).getTime() < Date.now()) {
    run(`DELETE FROM sessions WHERE id = ?`, id);
    return null;
  }

  return (
    get<User>(
      `SELECT id, email, name, created_at FROM users WHERE id = ?`,
      row.user_id,
    ) ?? null
  );
}
