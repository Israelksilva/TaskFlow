import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { createDatabase } from "../src/db/database";
import { MIGRATIONS_DIR, migrate } from "../src/db/migrate";

/** Migração com dados: parte do esquema anterior (001+002) com dados e aplica a 003. */
describe("migração 003 sobre dados existentes", () => {
  const db = createDatabase("pglite://memory");
  let dir = "";
  afterAll(async () => {
    await db.close();
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  it("preserva usuários, senhas e tarefas e aplica padrões seguros", async () => {
    dir = await mkdtemp(path.join(tmpdir(), "andamo-mig-"));
    for (const f of ["001_create_users_and_tasks.sql", "002_create_contact_messages.sql"]) {
      await cp(path.join(MIGRATIONS_DIR, f), path.join(dir, f));
    }
    await migrate(db, dir);
    const { rows: users } = await db.query<{ id: string }>(
      "INSERT INTO users (name, email, password_hash) VALUES ('Antiga', 'antiga@test.dev', '$2b$10$hash') RETURNING id",
    );
    await db.query("INSERT INTO tasks (user_id, title) VALUES ($1, 'Tarefa antiga')", [users[0].id]);

    await cp(path.join(MIGRATIONS_DIR, "003_auth_sessions_security.sql"), path.join(dir, "003_auth_sessions_security.sql"));
    expect(await migrate(db, dir)).toEqual(["003_auth_sessions_security.sql"]);

    const { rows } = await db.query(
      `SELECT name, email, password_hash, email_verified_at, totp_enabled_at, google_sub, locale, timezone FROM users`,
    );
    expect(rows).toEqual([
      {
        name: "Antiga",
        email: "antiga@test.dev",
        password_hash: "$2b$10$hash",
        email_verified_at: null,
        totp_enabled_at: null,
        google_sub: null,
        locale: "pt-BR",
        timezone: "America/Sao_Paulo",
      },
    ]);
    const { rows: tasks } = await db.query("SELECT title FROM tasks");
    expect(tasks).toEqual([{ title: "Tarefa antiga" }]);
    // reaplicar não faz nada
    expect(await migrate(db, dir)).toEqual([]);
  });
});
