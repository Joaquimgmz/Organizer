import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { SCHEMA } from "./schema";

/**
 * A single SQLite connection, cached on globalThis so Next.js hot reloads don't
 * open a new handle on every edit.
 *
 * We use the `node:sqlite` built-in (Node 22.5+) rather than better-sqlite3 so
 * the project installs with zero native compilation on any platform.
 */
declare global {
  // eslint-disable-next-line no-var
  var __routineDb: DatabaseSync | undefined;
}

function open(): DatabaseSync {
  const file =
    process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "routine.db");

  fs.mkdirSync(path.dirname(file), { recursive: true });

  const database = new DatabaseSync(file);
  database.exec(SCHEMA);
  return database;
}

export const db: DatabaseSync = globalThis.__routineDb ?? open();

if (process.env.NODE_ENV !== "production") {
  globalThis.__routineDb = db;
}

/** Value types SQLite can bind. */
type Bindable = null | number | bigint | string | Uint8Array;

/**
 * node:sqlite hands back objects with a null prototype. React refuses to pass
 * those from a Server Component to a Client Component, and they behave oddly
 * with things like `instanceof`, so every row is copied into a plain object on
 * the way out.
 */
function plain<T>(row: unknown): T {
  return { ...(row as object) } as T;
}

/** Run a query and return every row, typed. */
export function all<T>(sql: string, ...params: unknown[]): T[] {
  const rows = db.prepare(sql).all(...(params as Bindable[])) as unknown[];
  return rows.map((row) => plain<T>(row));
}

/** Run a query and return the first row, or undefined. */
export function get<T>(sql: string, ...params: unknown[]): T | undefined {
  const row = db.prepare(sql).get(...(params as Bindable[]));
  return row === undefined ? undefined : plain<T>(row);
}

/** Run a statement that doesn't return rows. */
export function run(sql: string, ...params: unknown[]) {
  return db.prepare(sql).run(...(params as Bindable[]));
}

/** Wrap a set of writes in a transaction. */
export function transaction<T>(fn: () => T): T {
  db.exec("BEGIN");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
