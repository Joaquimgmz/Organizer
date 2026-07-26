import { body, fail, json, str } from "@/lib/api";
import { createSession, hashPassword } from "@/lib/auth";
import { get, run } from "@/lib/db";
import { seedDemoData } from "@/lib/demo";
import { nowIso, uid } from "@/lib/utils";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const input = await body<{
    name?: string;
    email?: string;
    password?: string;
    seed?: boolean;
  }>(request);

  const name = str(input.name);
  const email = str(input.email).toLowerCase();
  const password = typeof input.password === "string" ? input.password : "";

  if (name.length < 2) return fail("Please enter your name.");
  if (!EMAIL_RE.test(email)) return fail("That email address doesn't look right.");
  if (password.length < 8) {
    return fail("Password must be at least 8 characters.");
  }

  const existing = get<{ id: string }>(
    `SELECT id FROM users WHERE email = ?`,
    email,
  );
  if (existing) return fail("An account with that email already exists.", 409);

  const id = uid("u_");
  run(
    `INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)`,
    id,
    email,
    name,
    hashPassword(password),
    nowIso(),
  );

  // Every new account starts with a month of example data so the app isn't
  // an empty shell on first load. Clearable from Settings.
  if (input.seed !== false) seedDemoData(id);

  await createSession(id);
  return json({ user: { id, email, name } }, 201);
}
