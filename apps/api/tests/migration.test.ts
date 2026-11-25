import { copyFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import { createDatabase } from "../src/db/database";
import { migrate, MIGRATIONS_DIR } from "../src/db/migrate";

/** Simula produção: banco com o esquema 001 e dados reais recebe a migração 002 sem perder nada. */
it("002 preserva usuários e tarefas existentes, criando workspace pessoal e projeto padrão", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "andamo-mig-"));
  const db = createDatabase("pglite://memory");
  try {
    await copyFile(path.join(MIGRATIONS_DIR, "001_create_users_and_tasks.sql"), path.join(dir, "001_create_users_and_tasks.sql"));
    await migrate(db, dir);
    const { rows: [user] } = await db.query<{ id: string }>(
      `INSERT INTO users (name, email, password_hash) VALUES ('Ana Lima', 'ana@a.dev', 'hash') RETURNING id`,
    );
    await db.query(
      `INSERT INTO tasks (user_id, title, status, position, priority, due_date) VALUES
        ($1, 'A', 'todo', 0, 'alta', '2030-01-01'), ($1, 'B', 'todo', 1, 'baixa', NULL), ($1, 'C', 'done', 0, 'media', NULL)`,
      [user.id],
    );

    expect(await migrate(db)).toEqual(expect.arrayContaining(["002_saas_foundation.sql"]));

    const { rows } = await db.query<{ title: string; status: string; position: number; ws_name: string; project: string; role: string }>(
      `SELECT t.title, t.status, t.position, w.name AS ws_name, p.name AS project, m.role
       FROM tasks t JOIN projects p ON p.id = t.project_id JOIN workspaces w ON w.id = t.workspace_id
       JOIN workspace_members m ON m.workspace_id = w.id AND m.user_id = t.user_id
       ORDER BY t.status, t.position`,
    );
    expect(rows).toEqual([
      { title: "C", status: "done", position: 0, ws_name: "Espaço de Ana", project: "Minhas tarefas", role: "owner" },
      { title: "A", status: "todo", position: 0, ws_name: "Espaço de Ana", project: "Minhas tarefas", role: "owner" },
      { title: "B", status: "todo", position: 1, ws_name: "Espaço de Ana", project: "Minhas tarefas", role: "owner" },
    ]);
    // 003: cada tarefa existente aponta para a coluna da sua categoria, mantendo a posição.
    const { rows: cols } = await db.query<{ title: string; category: string; name: string }>(
      `SELECT t.title, c.category, c.name FROM tasks t JOIN project_columns c ON c.id = t.column_id ORDER BY t.title`,
    );
    expect(cols).toEqual([
      { title: "A", category: "todo", name: "A Fazer" },
      { title: "B", category: "todo", name: "A Fazer" },
      { title: "C", category: "done", name: "Concluído" },
    ]);
    // Idempotente: rodar de novo não aplica nada.
    expect(await migrate(db)).toEqual([]);
  } finally {
    await db.close();
    await rm(dir, { recursive: true, force: true });
  }
});
