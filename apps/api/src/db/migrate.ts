import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { Database } from "./database";

/** Pasta com os arquivos `NNN_nome.sql` (relativa à raiz do pacote da API). */
export const MIGRATIONS_DIR = path.resolve(process.cwd(), "migrations");

/**
 * Aplica, em ordem e dentro de transação, as migrações ainda não registradas
 * na tabela `schema_migrations`. Retorna os nomes aplicados.
 */
export async function migrate(db: Database, dir = MIGRATIONS_DIR): Promise<string[]> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const { rows } = await db.query<{ name: string }>("SELECT name FROM schema_migrations");
  const applied = new Set(rows.map((r) => r.name));

  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  const pending = files.filter((f) => !applied.has(f));

  for (const file of pending) {
    const sql = await readFile(path.join(dir, file), "utf8");
    await db.transaction(async (tx) => {
      // Arquivos de migração são confiáveis (versionados no repositório) e podem ter vários comandos.
      for (const statement of splitStatements(sql)) await tx.query(statement);
      await tx.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
    });
  }

  return pending;
}

/** Separa comandos por `;` no fim da linha, ignorando comentários `--`. */
function splitStatements(sql: string): string[] {
  return sql
    .replace(/^\s*--.*$/gm, "")
    .split(/;\s*$/m)
    .map((s) => s.trim())
    .filter(Boolean);
}
