import { createClient, type Client, type InArgs } from "@libsql/client";
import path from "node:path";
import { SCHEMA } from "./schema";

/**
 * A single libSQL connection, cached on globalThis so Next.js hot reloads
 * don't open a new handle on every edit.
 *
 * libSQL is a SQLite-compatible engine with two modes we use here:
 *  - Local dev: a plain file on disk (`file:./data/routine.db`) — no account,
 *    no network, behaves exactly like the old node:sqlite setup.
 *  - Production: a hosted Turso database over HTTP, so the data survives on
 *    serverless hosts like Vercel where the filesystem is read-only /
 *    ephemeral and can't hold a local SQLite file between requests.
 *
 * Same SQL dialect either way, so schema.ts and every query in the app are
 * unchanged — only the connection layer and the sync-vs-async call shape
 * differ from the previous node:sqlite version.
 */
declare global {
  // eslint-disable-next-line no-var
  var __routineDb: Client | undefined;
  // eslint-disable-next-line no-var
  var __routineDbReady: Promise<unknown> | undefined;
}

function open(): Client {
  const url = process.env.TURSO_DATABASE_URL;

  if (url) {
    return createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "TURSO_DATABASE_URL must be set in production. A local SQLite file " +
        "doesn't survive on serverless hosts (Vercel's filesystem is " +
        "read-only/ephemeral). Create a free database at https://turso.tech " +
        "and set TURSO_DATABASE_URL (and TURSO_AUTH_TOKEN) in your project's " +
        "environment variables.",
    );
  }

  // Local dev: a plain file, no account needed.
  const file =
    process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "routine.db");
  return createClient({ url: `file:${file}` });
}

export const db: Client = globalThis.__routineDb ?? open();

if (process.env.NODE_ENV !== "production") {
  globalThis.__routineDb = db;
}

/** Apply the schema once per process; concurrent callers await the same promise. */
function ensureSchema(): Promise<unknown> {
  if (!globalThis.__routineDbReady) {
    globalThis.__routineDbReady = db.executeMultiple(SCHEMA);
  }
  return globalThis.__routineDbReady;
}

/** Value types libSQL can bind. */
type Bindable = null | number | bigint | string | Uint8Array;

/**
 * libSQL hands back row objects that aren't plain objects (proxied array-like
 * with named getters). React refuses to pass those from a Server Component to
 * a Client Component, so every row is copied into a plain object on the way
 * out — same reasoning as the old node:sqlite code.
 */
function plain<T>(row: Record<string, unknown>): T {
  return { ...row } as T;
}

/** Run a query and return every row, typed. */
export async function all<T>(sql: string, ...params: unknown[]): Promise<T[]> {
  await ensureSchema();
  const result = await db.execute({ sql, args: params as InArgs as Bindable[] });
  return result.rows.map((row) => plain<T>(row as unknown as Record<string, unknown>));
}

/** Run a query and return the first row, or undefined. */
export async function get<T>(
  sql: string,
  ...params: unknown[]
): Promise<T | undefined> {
  const rows = await all<T>(sql, ...params);
  return rows[0];
}

/** Run a statement that doesn't return rows. */
export async function run(sql: string, ...params: unknown[]) {
  await ensureSchema();
  const result = await db.execute({ sql, args: params as InArgs as Bindable[] });
  return {
    changes: Number(result.rowsAffected ?? 0),
    lastInsertRowid: result.lastInsertRowid,
  };
}

type Scoped = {
  all: typeof all;
  get: typeof get;
  run: typeof run;
};

/**
 * Wrap a set of writes in a real interactive transaction. The callback
 * receives its own `{ all, get, run }` bound to the transaction — use those
 * (not the top-level exports) for every statement that must be atomic.
 */
export async function transaction<T>(
  fn: (scoped: Scoped) => Promise<T>,
): Promise<T> {
  await ensureSchema();
  const tx = await db.transaction("write");

  const scopedAll = async <U>(sql: string, ...params: unknown[]): Promise<U[]> => {
    const result = await tx.execute({ sql, args: params as InArgs as Bindable[] });
    return result.rows.map((row) => plain<U>(row as unknown as Record<string, unknown>));
  };
  const scopedGet = async <U>(
    sql: string,
    ...params: unknown[]
  ): Promise<U | undefined> => {
    const rows = await scopedAll<U>(sql, ...params);
    return rows[0];
  };
  const scopedRun = async (sql: string, ...params: unknown[]) => {
    const result = await tx.execute({ sql, args: params as InArgs as Bindable[] });
    return {
      changes: Number(result.rowsAffected ?? 0),
      lastInsertRowid: result.lastInsertRowid,
    };
  };

  try {
    const result = await fn({ all: scopedAll, get: scopedGet, run: scopedRun });
    await tx.commit();
    return result;
  } catch (error) {
    await tx.rollback();
    throw error;
  }
}
