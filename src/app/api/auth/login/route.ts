import { body, fail, json, str } from "@/lib/api";
import { createSession, verifyPassword } from "@/lib/auth";
import { get } from "@/lib/db";

export async function POST(request: Request) {
  const input = await body<{ email?: string; password?: string }>(request);
  const email = str(input.email).toLowerCase();
  const password = typeof input.password === "string" ? input.password : "";

  if (!email || !password) return fail("Enter your email and password.");

  const user = await get<{
    id: string;
    email: string;
    name: string;
    password_hash: string;
  }>(`SELECT id, email, name, password_hash FROM users WHERE email = ?`, email);

  // Same message either way, so this can't be used to enumerate accounts.
  if (!user || !verifyPassword(password, user.password_hash)) {
    return fail("Incorrect email or password.", 401);
  }

  await createSession(user.id);
  return json({ user: { id: user.id, email: user.email, name: user.name } });
}
