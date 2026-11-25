import type { Recurrence, TaskPriority, TaskStatus } from "@andamo/shared";
import { db as defaultDb, type Queryable } from "../../db";

export interface TaskRow {
  id: string;
  workspace_id: string;
  project_id: string;
  column_id: string | null;
  parent_id: string | null;
  user_id: string | null;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  position: number;
  /** Datas sempre como texto YYYY-MM-DD (cast no SELECT evita conversões de fuso). */
  start_date: string | null;
  due_date: string | null;
  due_time: string | null;
  estimate_minutes: number | null;
  tracked_seconds: number;
  recurrence: string | null;
  assignee_ids: string[];
  label_ids: string[];
  subtask_count: number;
  subtask_done: number;
  checklist_count: number;
  checklist_done: number;
  comment_count: number;
  completed_at: Date | string | null;
  archived_at: Date | string | null;
  deleted_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export const TASK_SELECT = `SELECT t.id, t.workspace_id, t.project_id, t.column_id, t.parent_id, t.user_id, t.title, t.description,
  t.priority, t.status, t.position, t.start_date::text AS start_date, t.due_date::text AS due_date,
  to_char(t.due_time, 'HH24:MI') AS due_time, t.estimate_minutes, t.recurrence,
  (SELECT COALESCE(sum(COALESCE(e.duration_seconds, extract(epoch FROM now() - e.started_at)::int)), 0)::int
     FROM time_entries e WHERE e.task_id = t.id) AS tracked_seconds,
  COALESCE((SELECT array_agg(a.user_id ORDER BY a.assigned_at) FROM task_assignees a WHERE a.task_id = t.id), '{}') AS assignee_ids,
  COALESCE((SELECT array_agg(l.label_id) FROM task_labels l WHERE l.task_id = t.id), '{}') AS label_ids,
  (SELECT count(*)::int FROM tasks s WHERE s.parent_id = t.id AND s.deleted_at IS NULL) AS subtask_count,
  (SELECT count(*)::int FROM tasks s WHERE s.parent_id = t.id AND s.deleted_at IS NULL AND s.status = 'done') AS subtask_done,
  (SELECT count(*)::int FROM checklist_items c WHERE c.task_id = t.id) AS checklist_count,
  (SELECT count(*)::int FROM checklist_items c WHERE c.task_id = t.id AND c.done) AS checklist_done,
  (SELECT count(*)::int FROM comments c WHERE c.task_id = t.id AND c.deleted_at IS NULL) AS comment_count,
  t.completed_at, t.archived_at, t.deleted_at, t.created_at, t.updated_at
  FROM tasks t`;

/** Colunas editáveis: o nome vem desta lista fixa, nunca do cliente. */
const EDITABLE = {
  title: "title",
  description: "description",
  priority: "priority",
  status: "status",
  position: "position",
  dueDate: "due_date",
  startDate: "start_date",
  dueTime: "due_time",
  estimateMinutes: "estimate_minutes",
  recurrence: "recurrence",
  completedAt: "completed_at",
  projectId: "project_id",
  columnId: "column_id",
  archivedAt: "archived_at",
  deletedAt: "deleted_at",
} as const;

export type TaskChanges = Partial<{
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  position: number;
  dueDate: string | null;
  startDate: string | null;
  dueTime: string | null;
  estimateMinutes: number | null;
  recurrence: Recurrence | null;
  completedAt: Date | null;
  projectId: string;
  columnId: string | null;
  archivedAt: Date | null;
  deletedAt: Date | null;
}>;

export interface NewTask {
  workspaceId: string;
  projectId: string;
  columnId: string | null;
  parentId: string | null;
  userId: string;
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  position: number;
  startDate: string | null;
  dueDate: string | null;
  dueTime: string | null;
  estimateMinutes: number | null;
  recurrence: Recurrence | null;
  completedAt: Date | null;
}

/** Tarefas que aparecem no quadro: principais, ativas (fora da lixeira e do arquivo). */
const ON_BOARD = "t.parent_id IS NULL AND t.archived_at IS NULL AND t.deleted_at IS NULL";

export const taskRepository = {
  /** Quadro de um projeto, na ordem das colunas. */
  async listBoard(projectId: string, db: Queryable = defaultDb): Promise<TaskRow[]> {
    const { rows } = await db.query<TaskRow>(
      `${TASK_SELECT} WHERE t.project_id = $1 AND ${ON_BOARD}
       ORDER BY (SELECT c.position FROM project_columns c WHERE c.id = t.column_id) NULLS LAST, t.position, t.created_at`,
      [projectId],
    );
    return rows;
  },

  /** Serializa reordenações concorrentes do mesmo projeto (duas abas arrastando ao mesmo tempo). */
  async lockProject(projectId: string, db: Queryable): Promise<void> {
    await db.query("SELECT id FROM projects WHERE id = $1 FOR UPDATE", [projectId]);
  },

  /** Busca a tarefa apenas se pertencer ao workspace (proteção contra IDOR). */
  async findInWorkspace(id: string, workspaceId: string, db: Queryable = defaultDb): Promise<TaskRow | null> {
    const { rows } = await db.query<TaskRow>(`${TASK_SELECT} WHERE t.id = $1 AND t.workspace_id = $2`, [id, workspaceId]);
    return rows[0] ?? null;
  },

  async findManyInWorkspace(ids: string[], workspaceId: string, db: Queryable = defaultDb): Promise<TaskRow[]> {
    if (!ids.length) return [];
    const { rows } = await db.query<TaskRow>(
      `${TASK_SELECT} WHERE t.id = ANY($1::uuid[]) AND t.workspace_id = $2`,
      [ids, workspaceId],
    );
    return rows;
  },

  async subtasks(parentId: string, db: Queryable = defaultDb): Promise<TaskRow[]> {
    const { rows } = await db.query<TaskRow>(
      `${TASK_SELECT} WHERE t.parent_id = $1 AND t.deleted_at IS NULL ORDER BY t.position, t.created_at`,
      [parentId],
    );
    return rows;
  },

  async countInColumn(columnId: string, db: Queryable = defaultDb) {
    const { rows } = await db.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM tasks t WHERE t.column_id = $1 AND ${ON_BOARD}`,
      [columnId],
    );
    return rows[0].count;
  },

  async countSubtasks(parentId: string, db: Queryable = defaultDb) {
    const { rows } = await db.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM tasks WHERE parent_id = $1 AND deleted_at IS NULL`,
      [parentId],
    );
    return rows[0].count;
  },

  async create(task: NewTask, db: Queryable = defaultDb): Promise<string> {
    const { rows } = await db.query<{ id: string }>(
      `INSERT INTO tasks (workspace_id, project_id, parent_id, user_id, title, description, priority, status, position,
         start_date, due_date, due_time, estimate_minutes, recurrence, completed_at, column_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       RETURNING id`,
      [
        task.workspaceId, task.projectId, task.parentId, task.userId, task.title, task.description, task.priority,
        task.status, task.position, task.startDate, task.dueDate, task.dueTime, task.estimateMinutes,
        task.recurrence, task.completedAt, task.columnId,
      ],
    );
    return rows[0].id;
  },

  /** UPDATE apenas das colunas informadas; `updated_at` é sempre renovado. */
  async update(id: string, changes: TaskChanges, db: Queryable = defaultDb): Promise<void> {
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
    await db.query(`UPDATE tasks SET ${sets.join(", ")} WHERE id = $${params.length}`, params);
  },

  /** Atualiza apenas a posição (reordenação: não conta como "edição" da tarefa). */
  async setPosition(id: string, position: number, db: Queryable = defaultDb): Promise<void> {
    await db.query(`UPDATE tasks SET position = $2 WHERE id = $1`, [id, position]);
  },

  async setAssignees(taskId: string, userIds: string[], db: Queryable = defaultDb): Promise<void> {
    await db.query(`DELETE FROM task_assignees WHERE task_id = $1 AND NOT (user_id = ANY($2::uuid[]))`, [taskId, userIds]);
    if (userIds.length) {
      await db.query(
        `INSERT INTO task_assignees (task_id, user_id) SELECT $1, unnest($2::uuid[]) ON CONFLICT DO NOTHING`,
        [taskId, userIds],
      );
    }
  },

  async setLabels(taskId: string, labelIds: string[], db: Queryable = defaultDb): Promise<void> {
    await db.query(`DELETE FROM task_labels WHERE task_id = $1`, [taskId]);
    if (labelIds.length) {
      await db.query(`INSERT INTO task_labels (task_id, label_id) SELECT $1, unnest($2::uuid[]) ON CONFLICT DO NOTHING`, [
        taskId,
        labelIds,
      ]);
    }
  },

  async delete(id: string, db: Queryable = defaultDb): Promise<void> {
    await db.query("DELETE FROM tasks WHERE id = $1", [id]);
  },
};
