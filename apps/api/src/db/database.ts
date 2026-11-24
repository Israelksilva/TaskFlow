import { mkdirSync } from "node:fs";
import path from "node:path";
import pg from "pg";

/**
 * Abstração mínima sobre o banco. Toda consulta é parametrizada
 * (`$1, $2, ...`) — nunca concatenamos valores no SQL.
 */
export interface Queryable {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<{ rows: T[] }>;
}

export interface Database extends Queryable {
  /** Executa `fn` numa transação (COMMIT ao final, ROLLBACK em caso de erro). */
  transaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

/** PostgreSQL real (Neon em produção) via pool de conexões. */
function createPgDatabase(connectionString: string): Database {
  const pool = new pg.Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

  return {
    async query<T>(text: string, params: unknown[] = []) {
      const result = await pool.query(text, params);
      return { rows: result.rows as T[] };
    },
    async transaction(fn) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await fn({
          async query<T>(text: string, params: unknown[] = []) {
            const r = await client.query(text, params);
            return { rows: r.rows as T[] };
          },
        });
        await client.query("COMMIT");
        return result;
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
}

/**
 * Postgres embutido (PGlite/WASM) para testes e desenvolvimento sem Neon.
 * `pglite://memory` → em memória; `pglite://./.data/dev` → persistido em disco.
 */
function createPgliteDatabase(url: string): Database {
  const location = url.replace(/^pglite:\/\//, "");
  const inMemory = location === "memory";
  if (!inMemory) mkdirSync(path.dirname(path.resolve(location)), { recursive: true });
  const instance = import("@electric-sql/pglite").then(
    ({ PGlite }) => new PGlite(inMemory ? undefined : location),
  );

  return {
    async query<T>(text: string, params: unknown[] = []) {
      const db = await instance;
      const r = await db.query<T>(text, params);
      return { rows: r.rows };
    },
    async transaction(fn) {
      const db = await instance;
      return db.transaction((tx) =>
        fn({
          async query<T>(text: string, params: unknown[] = []) {
            const r = await tx.query<T>(text, params);
            return { rows: r.rows };
          },
        }),
      );
    },
    async close() {
      await (await instance).close();
    },
  };
}

export function createDatabase(url: string): Database {
  return url.startsWith("pglite://") ? createPgliteDatabase(url) : createPgDatabase(url);
}
