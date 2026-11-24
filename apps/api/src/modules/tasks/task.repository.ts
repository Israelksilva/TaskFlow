import type { TaskPriority, TaskStatus } from "@andamo/shared";
import { db as defaultDb, type Queryable } from "../../db";

export interface TaskRow {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  position: number;
  /** Sempre texto YYYY-MM-DD (cast no SELECT evita conversões de fuso). */
  due_date: string | null;
  completed_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

const COLUMNS = `id, user_id, title, description, priority, status, position,
  due_date::text AS due_date, completed_at, created_at, updated_at`;

/** Colunas editáveis: o nome vem desta lista fixa, nunca do cliente. */
const EDITABLE = {
  title: "title",
  description: "description",
  priority: "priority",
  status: "status",
  position: "position",
  dueDate: "due_date",
  completedAt: "completed_at",
} as const;

export type TaskChanges = Partial<{
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  position: number;
  dueDate: string | null;
  completedAt: Date | null;
}>;

export interface NewTask {
  userId: string;
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  position: number;
  dueDate: string | null;
  completedAt: Date | null;
}

export const taskRepository = {
  async listByUser(userId: string, db: Queryable = defaultDb): Promise<TaskRow[]> {
    const { rows } = await db.query<TaskRow>(
      `SELECT ${COLUMNS} FROM tasks WHERE user_id = $1
       ORDER BY CASE status WHEN 'todo' THEN 0 WHEN 'doing' THEN 1 ELSE 2 END, position, created_at`,
      [userId],
    );
    return rows;
  },

  /**
   * Bloqueia as tarefas do usuário até o fim da transação, serializando
   * reordenações concorrentes (duas abas arrastando ao mesmo tempo).
   */
  async lockByUser(userId: string, db: Queryable): Promise<void> {
    await db.query("SELECT id FROM tasks WHERE user_id = $1 FOR UPDATE", [userId]);
  },

  /** Busca a tarefa apenas se pertencer ao usuário. */
  async findOwned(id: string, userId: string, db: Queryable = defaultDb): Promise<TaskRow | null> {
    const { rows } = await db.query<TaskRow>(
      `SELECT ${COLUMNS} FROM tasks WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );
    return rows[0] ?? null;
  },

  async countInColumn(userId: string, status: TaskStatus, db: Queryable = defaultDb) {
    const { rows } = await db.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM tasks WHERE user_id = $1 AND status = $2",
      [userId, status],
    );
    return rows[0].count;
  },

  async create(task: NewTask, db: Queryable = defaultDb): Promise<TaskRow> {
    const { rows } = await db.query<TaskRow>(
      `INSERT INTO tasks (user_id, title, description, priority, status, position, due_date, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING ${COLUMNS}`,
      [
        task.userId,
        task.title,
        task.description,
        task.priority,
        task.status,
        task.position,
        task.dueDate,
        task.completedAt,
      ],
    );
    return rows[0];
  },

  /** UPDATE apenas das colunas informadas; `updated_at` é sempre renovado. */
  async update(id: string, changes: TaskChanges, db: Queryable = defaultDb): Promise<TaskRow> {
    const sets: string[] = [];
    const params: unknown[] = [];

    for (const [key, column] of Object.entries(EDITABLE)) {
      const value = changes[key as keyof TaskChanges];
      if (value === undefined) continue;
      params.push(value);
      sets.push(`${column} = $${params.length}`);
    }
    sets.push("updated_at = now()");
    params.push(id);

    const { rows } = await db.query<TaskRow>(
      `UPDATE tasks SET ${sets.join(", ")} WHERE id = $${params.length} RETURNING ${COLUMNS}`,
      params,
    );
    return rows[0];
  },

  async delete(id: string, db: Queryable = defaultDb): Promise<void> {
    await db.query("DELETE FROM tasks WHERE id = $1", [id]);
  },
};
