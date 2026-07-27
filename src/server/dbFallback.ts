import type { Response } from "express";
import type pg from "pg";

/** Pool of the active connection, or null while the app runs on the in-memory fallback. */
export type ActivePool = pg.Pool | null;

type Row = Record<string, unknown>;

/**
 * Answers a listing endpoint from Postgres, falling back to the in-memory cache
 * whenever the database is unavailable or the query fails.
 */
export const respondWithRows = async <T>(
  res: Response,
  pool: ActivePool,
  sql: string,
  fallback: T[],
  mapRow?: (row: Row) => Row
): Promise<void> => {
  if (pool) {
    try {
      const result = await pool.query(sql);
      res.json(mapRow ? result.rows.map(mapRow) : result.rows);
      return;
    } catch (e) {
      console.error(e);
    }
  }
  res.json(fallback);
};

/** Deletes a row by id, or applies the in-memory removal when the database is unavailable. */
export const respondWithDelete = async (
  res: Response,
  pool: ActivePool,
  table: string,
  id: string,
  removeFromCache: () => void,
  errorMessage = "Erro ao deletar"
): Promise<void> => {
  if (pool) {
    try {
      await pool.query(`DELETE FROM ${table} WHERE id = $1`, [id]);
      res.json({ success: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: errorMessage });
    }
    return;
  }
  removeFromCache();
  res.json({ success: true });
};

export const buildInsert = (table: string, columns: string[]): string => {
  const placeholders = columns.map((_, index) => `$${index + 1}`).join(", ");
  return `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`;
};

/** INSERT ... ON CONFLICT DO UPDATE covering `updateColumns` (every column but the key by default). */
export const buildUpsert = (
  table: string,
  columns: string[],
  options: { conflictColumn?: string; updateColumns?: string[] } = {}
): string => {
  const conflictColumn = options.conflictColumn ?? "id";
  const updateColumns = options.updateColumns ?? columns.filter(column => column !== conflictColumn);
  const assignments = updateColumns.map(column => `${column} = EXCLUDED.${column}`).join(", ");
  return `${buildInsert(table, columns)} ON CONFLICT (${conflictColumn}) DO UPDATE SET ${assignments}`;
};

/** Values of `columns` taken from a record, in the order expected by the generated statement. */
export const valuesOf = (columns: string[], row: Row): unknown[] => columns.map(column => row[column]);

/** Inserts or replaces an item of the in-memory cache, keyed by id. */
export const upsertCacheItem = <T extends { id: string }>(
  cache: T[],
  item: T,
  position: "start" | "end" = "end"
): T => {
  const index = cache.findIndex(entry => entry.id === item.id);
  if (index > -1) {
    cache[index] = item;
  } else if (position === "start") {
    cache.unshift(item);
  } else {
    cache.push(item);
  }
  return item;
};
