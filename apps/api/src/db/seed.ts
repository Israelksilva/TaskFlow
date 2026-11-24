/**
 * Cria um usuário de demonstração com tarefas de exemplo.
 *   E-mail: demo@andamo.dev   Senha: demo1234
 * Executar: npm run db:seed (após npm run db:migrate)
 */
import { addDays, toISODate, type TaskPriority, type TaskStatus } from "@andamo/shared";
import { hashPassword } from "../lib/password";
import { db } from "./index";
import { migrate } from "./migrate";

const EMAIL = "demo@andamo.dev";
const today = toISODate();

const tasks: Array<[string, string | null, TaskPriority, TaskStatus, string | null]> = [
  ["Definir requisitos", "Levantar os fluxos principais com o time", "alta", "done", null],
  ["Modelar banco de dados", "Tabelas users e tasks no PostgreSQL", "alta", "done", null],
  ["Implementar API REST", "Express + TypeScript + validação com Zod", "alta", "doing", addDays(today, 1)],
  ["Conectar front-end com React Query", null, "media", "doing", addDays(today, 3)],
  ["Escrever testes automatizados", null, "media", "todo", addDays(today, 5)],
  ["Configurar deploy no Render", null, "baixa", "todo", null],
  ["Atualizar o README", "Documentar comandos e variáveis de ambiente", "baixa", "todo", addDays(today, -1)],
];

await migrate(db);

await db.transaction(async (tx) => {
  await tx.query("DELETE FROM users WHERE email = $1", [EMAIL]);
  const { rows } = await tx.query<{ id: string }>(
    "INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id",
    ["Usuário Demo", EMAIL, await hashPassword("demo1234")],
  );
  const positions: Record<string, number> = {};
  for (const [title, description, priority, status, dueDate] of tasks) {
    const position = (positions[status] = (positions[status] ?? -1) + 1);
    await tx.query(
      `INSERT INTO tasks (user_id, title, description, priority, status, position, due_date, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [rows[0].id, title, description, priority, status, position, dueDate, status === "done" ? new Date() : null],
    );
  }
});

console.log(`🌱 Seed concluído. Login: ${EMAIL} / demo1234`);
await db.close();
