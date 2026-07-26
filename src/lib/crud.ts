import { run } from "./db";

/**
 * Build and run an UPDATE from a map of already-validated column values.
 *
 * Table and column names always come from literals in our own route files —
 * never from request data — and every value is bound as a parameter.
 */
export async function applyUpdates(
  table: string,
  id: string,
  userId: string,
  updates: Record<string, unknown>,
): Promise<number> {
  const columns = Object.keys(updates);
  if (columns.length === 0) return 0;

  const assignments = columns.map((column) => `${column} = ?`).join(", ");
  const result = await run(
    `UPDATE ${table} SET ${assignments} WHERE id = ? AND user_id = ?`,
    ...columns.map((column) => updates[column]),
    id,
    userId,
  );

  return Number(result.changes ?? 0);
}

export async function deleteRow(
  table: string,
  id: string,
  userId: string,
): Promise<number> {
  const result = await run(
    `DELETE FROM ${table} WHERE id = ? AND user_id = ?`,
    id,
    userId,
  );
  return Number(result.changes ?? 0);
}

/** Collect only the keys the caller actually sent, mapped through a validator. */
export function pick<T extends Record<string, unknown>>(
  input: Record<string, unknown>,
  validators: { [K in keyof T]: (value: unknown) => T[K] },
): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(validators)) {
    if (key in input) out[key] = validators[key as keyof T](input[key]);
  }
  return out as Partial<T>;
}
