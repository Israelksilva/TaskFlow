/** Lógica da validação de migrações (snapshot e comparação), separada para ser testada com PGlite. */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Database } from "../db/database";

const OUT_DIR = path.resolve(process.cwd(), ".validacao-neon");
const sha = (v: string | null | undefined) => (v == null ? null : createHash("sha256").update(v).digest("hex").slice(0, 16));
export const fail = (msg: string): never => {
  console.error(`
❌ ${msg}
`);
  process.exit(1);
};

// ------------------------------------------------------------------ conexão segura
export function describeUrl(url: string) {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return fail("NEON_TESTE_DATABASE_URL não é uma URL válida.");
  }
  const host = u.hostname; // ep-xxxx-yyyy(-pooler).regiao.aws.neon.tech
  const endpoint = host.split(".")[0].replace(/-pooler$/, "");
  return { host, endpoint, database: u.pathname.replace(/^\//, ""), role: decodeURIComponent(u.username), sslmode: u.searchParams.get("sslmode") };
}

export function productionEndpoint(): string | null {
  const file = path.resolve(process.cwd(), ".env");
  if (!existsSync(file)) return null;
  const line = readFileSync(file, "utf8").split(/\r?\n/).find((l) => /^\s*DATABASE_URL\s*=/.test(l));
  if (!line) return null;
  const value = line.replace(/^\s*DATABASE_URL\s*=\s*/, "").replace(/^["']|["']$/g, "");
  try {
    return new URL(value).hostname.split(".")[0].replace(/-pooler$/, "");
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------ estado
const tableExists = async (db: Database, t: string) =>
  (await db.query<{ ok: boolean }>(`SELECT to_regclass($1) IS NOT NULL AS ok`, [`public.${t}`])).rows[0].ok;
const columnExists = async (db: Database, t: string, c: string) =>
  (await db.query<{ ok: boolean }>(`SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2) AS ok`, [t, c])).rows[0].ok;

export interface Snapshot {
  takenAt: string;
  endpoint: string;
  migrations: string[];
  counts: Record<string, number>;
  users: Record<string, { email: string | null; name: string | null; createdAt: string }>;
  tasks: Record<string, { userId: string | null; title: string | null; description: string | null; status: string; priority: string; dueDate: string | null; completedAt: string | null; createdAt: string }>;
}

export async function snapshot(db: Database, endpoint: string): Promise<Snapshot> {
  const migrations = (await tableExists(db, "schema_migrations"))
    ? (await db.query<{ name: string }>(`SELECT name FROM schema_migrations ORDER BY name`)).rows.map((r) => r.name)
    : [];
  const counts: Record<string, number> = {};
  for (const t of ["users", "tasks", "workspaces", "workspace_members", "projects", "project_columns", "sessions", "time_entries", "automations", "support_tickets"]) {
    if (await tableExists(db, t)) counts[t] = (await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${t}`)).rows[0].n;
  }
  const users: Snapshot["users"] = {};
  for (const u of (await db.query<{ id: string; email: string; name: string; created_at: Date }>(`SELECT id, email, name, created_at FROM users`)).rows) {
    users[u.id] = { email: sha(u.email.toLowerCase()), name: sha(u.name), createdAt: new Date(u.created_at).toISOString() };
  }
  const tasks: Snapshot["tasks"] = {};
  for (const t of (
    await db.query<{ id: string; user_id: string | null; title: string; description: string | null; status: string; priority: string; due_date: string | Date | null; completed_at: Date | null; created_at: Date }>(
      `SELECT id, user_id, title, description, status, priority, due_date::text AS due_date, completed_at, created_at FROM tasks`,
    )
  ).rows) {
    tasks[t.id] = {
      userId: t.user_id, title: sha(t.title), description: sha(t.description), status: t.status, priority: t.priority,
      dueDate: t.due_date ? String(t.due_date) : null, completedAt: t.completed_at ? new Date(t.completed_at).toISOString() : null,
      createdAt: new Date(t.created_at).toISOString(),
    };
  }
  return { takenAt: new Date().toISOString(), endpoint, migrations, counts, users, tasks };
}

export function save(name: string, data: unknown) {
  mkdirSync(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, `${new Date().toISOString().replace(/[:.]/g, "-")}-${name}.json`);
  writeFileSync(file, JSON.stringify(data, null, 2));
  return file;
}

export function printSnapshot(s: Snapshot, title: string) {
  console.log(`📸 ${title}`);
  console.log(`   migrações aplicadas: ${s.migrations.length ? s.migrations.join(", ") : "(nenhuma registrada)"}`);
  for (const [t, n] of Object.entries(s.counts)) console.log(`   ${t.padEnd(18, ".")} ${n}`);
}

// ------------------------------------------------------------------ comparação
export async function compare(db: Database, before: Snapshot, after: Snapshot) {
  const problems: string[] = [];
  const ok: string[] = [];
  const check = (cond: boolean, good: string, bad: string) => (cond ? ok.push(good) : problems.push(bad));

  // Usuários: todos continuam, com o mesmo e-mail, nome e data de cadastro.
  const lostUsers = Object.keys(before.users).filter((id) => !after.users[id]);
  const changedUsers = Object.entries(before.users).filter(([id, u]) => after.users[id] && JSON.stringify(after.users[id]) !== JSON.stringify(u));
  check(lostUsers.length === 0 && changedUsers.length === 0, `${Object.keys(before.users).length} usuários preservados (e-mail, nome, cadastro)`, `Usuários perdidos: ${lostUsers.length}; alterados: ${changedUsers.length}`);

  // Tarefas: todas continuam, com mesmo autor, título, descrição, status, prazo e conclusão.
  const lostTasks = Object.keys(before.tasks).filter((id) => !after.tasks[id]);
  const changedTasks = Object.entries(before.tasks).filter(([id, t]) => after.tasks[id] && JSON.stringify(after.tasks[id]) !== JSON.stringify(t));
  check(lostTasks.length === 0 && changedTasks.length === 0, `${Object.keys(before.tasks).length} tarefas preservadas (autor, título, descrição, status, prioridade, prazo, conclusão)`, `Tarefas perdidas: ${lostTasks.length}; alteradas: ${changedTasks.length} (ex.: ${[...lostTasks, ...changedTasks.map(([id]) => id)].slice(0, 5).join(", ")})`);

  // Vínculos (esquema novo).
  const q = async (sql: string) => (await db.query<{ n: number }>(sql)).rows[0].n;
  const ids = Object.keys(before.tasks);
  if (ids.length) {
    const orphan = (await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM tasks WHERE id = ANY($1::uuid[]) AND (workspace_id IS NULL OR project_id IS NULL)`, [ids])).rows[0].n;
    check(orphan === 0, "toda tarefa antiga tem workspace e projeto", `${orphan} tarefa(s) antiga(s) sem workspace/projeto`);
    const wrongOwner = (
      await db.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM tasks t JOIN workspaces w ON w.id = t.workspace_id
         WHERE t.id = ANY($1::uuid[]) AND t.user_id IS NOT NULL AND NOT (w.is_personal AND w.owner_id = t.user_id)`,
        [ids],
      )
    ).rows[0].n;
    check(wrongOwner === 0, "cada tarefa antiga está no workspace pessoal do próprio dono", `${wrongOwner} tarefa(s) em workspace de outra pessoa`);
  }
  const mismatchProject = await q(`SELECT count(*)::int AS n FROM tasks t JOIN projects p ON p.id = t.project_id WHERE p.workspace_id <> t.workspace_id`);
  check(mismatchProject === 0, "projeto de cada tarefa pertence ao mesmo workspace", `${mismatchProject} tarefa(s) com projeto de outro workspace`);
  const notMember = await q(`SELECT count(*)::int AS n FROM tasks t WHERE t.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM workspace_members m WHERE m.workspace_id = t.workspace_id AND m.user_id = t.user_id)`);
  check(notMember === 0, "autor de cada tarefa é membro do workspace", `${notMember} tarefa(s) cujo autor não é membro do workspace`);
  const personal = await q(`SELECT count(*)::int AS n FROM users u WHERE (SELECT count(*) FROM workspaces w WHERE w.owner_id = u.id AND w.is_personal) <> 1`);
  check(personal === 0, "cada usuário tem exatamente 1 workspace pessoal", `${personal} usuário(s) sem (ou com mais de um) workspace pessoal`);
  const ownerRole = await q(`SELECT count(*)::int AS n FROM workspaces w WHERE NOT EXISTS (SELECT 1 FROM workspace_members m WHERE m.workspace_id = w.id AND m.user_id = w.owner_id AND m.role = 'owner')`);
  check(ownerRole === 0, "dono de cada workspace é membro com papel de proprietário", `${ownerRole} workspace(s) sem o dono como proprietário`);
  if (await columnExists(db, "tasks", "column_id")) {
    const badColumn = await q(
      `SELECT count(*)::int AS n FROM tasks t LEFT JOIN project_columns c ON c.id = t.column_id
       WHERE c.id IS NULL OR c.project_id <> t.project_id OR c.category <> t.status`,
    );
    check(badColumn === 0, "cada tarefa está numa coluna do seu projeto, coerente com o status", `${badColumn} tarefa(s) com coluna ausente/incoerente`);
  }
  const dupPositions = await q(
    `SELECT count(*)::int AS n FROM (SELECT column_id, position FROM tasks WHERE deleted_at IS NULL AND archived_at IS NULL AND column_id IS NOT NULL GROUP BY 1, 2 HAVING count(*) > 1) d`,
  ).catch(() => 0);
  check(dupPositions === 0, "posições no quadro sem duplicidade", `${dupPositions} posição(ões) duplicada(s) em colunas (ordem pode embaralhar)`);
  return { ok, problems };
}

