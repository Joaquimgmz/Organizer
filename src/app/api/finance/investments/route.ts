import {
  body,
  dateStr,
  fail,
  json,
  num,
  oneOf,
  str,
  withUser,
} from "@/lib/api";
import { all, run } from "@/lib/db";
import { FREQUENCIES, type Investment } from "@/lib/types";
import { nowIso, today, uid } from "@/lib/utils";

export const GET = withUser(async (user) => {
  const investments = all<Investment>(
    `SELECT id, title, down_payment, contribution_amount, frequency, start_date, notes, created_at
       FROM investments WHERE user_id = ? ORDER BY created_at DESC`,
    user.id,
  );
  return json({ investments });
});

export const POST = withUser(async (user, request) => {
  const input = await body<Record<string, unknown>>(request);

  const title = str(input.title);
  if (!title) return fail("Give the investment a title.");

  const downPayment = Math.round(Math.max(0, num(input.down_payment)) * 100) / 100;
  const contribution =
    Math.round(Math.max(0, num(input.contribution_amount)) * 100) / 100;

  // A plan with neither an up-front amount nor a recurring one tracks nothing.
  if (downPayment === 0 && contribution === 0) {
    return fail("Enter a down payment, a recurring amount, or both.");
  }

  const id = uid("i_");
  run(
    `INSERT INTO investments
       (id, user_id, title, down_payment, contribution_amount, frequency, start_date, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    user.id,
    title,
    downPayment,
    contribution,
    oneOf(input.frequency, FREQUENCIES, "monthly"),
    dateStr(input.start_date, today()),
    str(input.notes),
    nowIso(),
  );

  return json({ id }, 201);
});
