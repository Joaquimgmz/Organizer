import { body, dateStr, fail, json, num, query, str, withUser } from "@/lib/api";
import { all, run } from "@/lib/db";
import { clamp, nowIso, today, uid } from "@/lib/utils";

type Row = {
  id: string;
  date: string;
  title: string;
  content: string;
  mood: number;
  tags: string;
  created_at: string;
  updated_at: string;
};

function normaliseTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value
        .filter((tag): tag is string => typeof tag === "string")
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean),
    ),
  ].slice(0, 12);
}

export const GET = withUser(async (user, request) => {
  const params = query(request);
  const search = str(params.get("q")).toLowerCase();
  const tag = str(params.get("tag")).toLowerCase();
  const date = params.get("date");

  let sql = `SELECT * FROM diary_entries WHERE user_id = ?`;
  const args: unknown[] = [user.id];

  if (date) {
    sql += ` AND date = ?`;
    args.push(dateStr(date, today()));
  }
  if (search) {
    sql += ` AND (lower(title) LIKE ? OR lower(content) LIKE ?)`;
    args.push(`%${search}%`, `%${search}%`);
  }
  if (tag) {
    sql += ` AND lower(tags) LIKE ?`;
    args.push(`%"${tag}"%`);
  }

  sql += ` ORDER BY date DESC, created_at DESC LIMIT 200`;

  const rows = await all<Row>(sql, ...args);
  const entries = rows.map((row) => ({
    ...row,
    tags: JSON.parse(row.tags || "[]") as string[],
  }));

  return json({ entries });
});

export const POST = withUser(async (user, request) => {
  const input = await body<Record<string, unknown>>(request);

  const content = str(input.content);
  if (!content) return fail("Write something before saving.");

  const id = uid("d_");
  const stamp = nowIso();

  await run(
    `INSERT INTO diary_entries (id, user_id, date, title, content, mood, tags, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    user.id,
    dateStr(input.date, today()),
    str(input.title),
    content,
    clamp(Math.round(num(input.mood, 3)), 1, 5),
    JSON.stringify(normaliseTags(input.tags)),
    stamp,
    stamp,
  );

  return json({ id }, 201);
});
