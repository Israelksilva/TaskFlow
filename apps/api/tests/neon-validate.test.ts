import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { createDatabase } from "../src/db/database";
import { migrate, MIGRATIONS_DIR } from "../src/db/migrate";
import { compare, snapshot } from "../src/scripts/neon-validate-lib";

/**
 * Simula a produção atual (só a migração 001, com dados) e valida que 002–005 preservam usuários, tarefas e
 * vínculos — o mesmo procedimento que o script roda na branch de teste do Neon.
 */
const only001 = mkdtempSync(path.join(tmpdir(), "andamo-mig-"));
cpSync(path.join(MIGRATIONS_DIR, "001_create_users_and_tasks.sql"), path.join(only001, "001_create_users_and_tasks.sql"));
afterAll(() => rmSync(only001, { recursive: true, force: true }));

async function legacyDatabase() {
  const db = createDatabase("pglite://memory");
  await migrate(db, only001);
  const users = await db.query<{ id: string }>(
    `INSERT INTO users (name, email, password_hash) VALUES ('Ana', 'ana@x.dev', 'h'), ('Bruno', 'Bruno@X.dev', 'h'), ('Sem tarefas', 'c@x.dev', 'h') RETURNING id`,
  );
  const [ana, bruno] = users.rows.map((r) => r.id);
  await db.query(
    `INSERT INTO tasks (user_id, title, description, priority, status, position, due_date, completed_at) VALUES
      ($1, 'Comprar pão', NULL, 'baixa', 'todo', 0, NULL, NULL),
      ($1, 'Pagar conta', 'até sexta', 'alta', 'doing', 0, '2026-01-10', NULL),
      ($1, 'Feito', NULL, 'media', 'done', 0, NULL, now()),
      ($1, 'Também a fazer', NULL, 'media', 'todo', 1, NULL, NULL),
      ($2, 'Tarefa do Bruno', NULL, 'alta', 'todo', 0, '2026-02-01', NULL)`,
    [ana, bruno],
  );
  return db;
}

describe("validação de migrações (simulação da branch do Neon)", () => {
  it("002–005 preservam usuários, tarefas e vínculos", async () => {
    const db = await legacyDatabase();
    const before = await snapshot(db, "ep-teste");
    expect(before.migrations).toEqual(["001_create_users_and_tasks.sql"]);
    expect(Object.keys(before.tasks)).toHaveLength(5);

    const applied = await migrate(db);
    expect(applied).toEqual(["002_saas_foundation.sql", "003_columns_and_time.sql", "004_automations.sql", "005_admin_support.sql"]);
    const after = await snapshot(db, "ep-teste");
    const result = await compare(db, before, after);
    expect(result.problems).toEqual([]);
    expect(result.ok.length).toBeGreaterThanOrEqual(8);
    expect(after.counts.workspaces).toBe(3);
    await db.close();
  });

  it("acusa perda ou alteração de dados", async () => {
    const db = await legacyDatabase();
    const before = await snapshot(db, "ep-teste");
    await migrate(db);
    await db.query(`UPDATE tasks SET title = 'alterado' WHERE title = 'Comprar pão'`);
    await db.query(`DELETE FROM tasks WHERE title = 'Feito'`);
    const result = await compare(db, before, await snapshot(db, "ep-teste"));
    expect(result.problems.join(" ")).toMatch(/Tarefas perdidas: 1; alteradas: 1/);
    await db.close();
  });
});
