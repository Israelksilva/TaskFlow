import type { z } from "zod";
import {
  addDays,
  can,
  diffColumnOrder,
  groupByColumn,
  moveToColumn,
  normalizeText,
  type BoardColumn,
  type BulkTaskInput,
  type ChecklistItem,
  type createTaskSchema,
  type Recurrence,
  type Role,
  type Task,
  type TaskDetail,
  type TaskQuery,
  type TaskStatus,
  type updateTaskSchema,
} from "@andamo/shared";
import { db, type Queryable } from "../../db";
import { emit, type AutomationChain } from "../../events/bus";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "../../shared/errors";
import { activityRepository } from "../activity/activity.repository";
import { columnRepository } from "../projects/column.repository";
import { workspaceRepository } from "../workspaces/workspace.repository";
import { toTaskDTO } from "./task.mapper";
import { TASK_SELECT, taskRepository, type TaskChanges, type TaskRow } from "./task.repository";

export type CreateTaskData = z.output<typeof createTaskSchema>;
export type UpdateTaskData = z.output<typeof updateTaskSchema>;

/** Quem está agindo e em qual workspace (resolvido pelo middleware de tenant). */
export interface TaskContext {
  workspaceId: string;
  userId: string;
  role: Role;
  /** Presente quando a ação vem de uma automação. */
  automation?: AutomationChain;
}

/** Regra de `completedAt`: preenchido ao entrar em "Concluído", limpo ao sair, preservado se continuar concluída. */
function resolveCompletedAt(from: TaskStatus, to: TaskStatus, current: string | null) {
  if (to !== "done") return null;
  return from === "done" && current ? new Date(current) : new Date();
}

function nextOccurrence(date: string, recurrence: Recurrence): string {
  if (recurrence === "daily") return addDays(date, 1);
  if (recurrence === "weekly") return addDays(date, 7);
  const [y, m, d] = date.split("-").map(Number);
  const last = new Date(y, m + 1, 0).getDate(); // último dia do mês seguinte
  const next = new Date(y, m, Math.min(d, last));
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
}

async function loadOrFail(ctx: TaskContext, id: string, tx: Queryable = db, includeDeleted = false): Promise<Task> {
  const row = await taskRepository.findInWorkspace(id, ctx.workspaceId, tx);
  if (!row || (!includeDeleted && row.deleted_at)) throw new NotFoundError("Tarefa");
  return toTaskDTO(row);
}

function assertCanEdit(ctx: TaskContext, task: Task) {
  if (can(ctx.role, "tasks.edit")) return;
  if (can(ctx.role, "tasks.editAssigned") && task.assigneeIds.includes(ctx.userId)) return;
  throw new ForbiddenError("Você só pode editar tarefas atribuídas a você");
}

function assertCan(ctx: TaskContext, permission: "tasks.create" | "tasks.delete") {
  if (!can(ctx.role, permission)) throw new ForbiddenError();
}

async function assertProject(ctx: TaskContext, projectId: string, tx: Queryable) {
  const { rows } = await tx.query(
    `SELECT id FROM projects WHERE id = $1 AND workspace_id = $2 AND deleted_at IS NULL AND archived_at IS NULL`,
    [projectId, ctx.workspaceId],
  );
  if (!rows[0]) throw new NotFoundError("Projeto");
}

async function validLabels(workspaceId: string, ids: string[], tx: Queryable): Promise<string[]> {
  if (!ids.length) return [];
  const { rows } = await tx.query<{ id: string }>(`SELECT id FROM labels WHERE workspace_id = $1 AND id = ANY($2::uuid[])`, [
    workspaceId,
    ids,
  ]);
  return rows.map((r) => r.id);
}

/** Normaliza as posições (0..n-1) de cada coluna do quadro do projeto. */
async function compactBoard(tx: Queryable, projectId: string) {
  const columns = await columnRepository.list(projectId, tx);
  const before = (await taskRepository.listBoard(projectId, tx)).map(toTaskDTO);
  const groups = groupByColumn(before, columns);
  for (const list of Object.values(groups)) {
    for (const [position, task] of list.entries()) {
      if (task.position !== position) await taskRepository.setPosition(task.id, position, tx);
    }
  }
}

/**
 * Coluna de destino: a informada (validada no projeto) ou, a partir do status, a coluna atual
 * se já tiver essa categoria, senão a primeira coluna com essa categoria.
 */
function pickColumn(columns: BoardColumn[], opts: { columnId?: string | null; status?: TaskStatus; current?: string | null }): BoardColumn {
  if (opts.columnId) {
    const col = columns.find((c) => c.id === opts.columnId);
    if (!col) throw new BadRequestError("Coluna inválida para este projeto", "INVALID_COLUMN");
    return col;
  }
  const status = opts.status ?? "todo";
  const current = columns.find((c) => c.id === opts.current);
  if (current && current.category === status) return current;
  const col = columns.find((c) => c.category === status) ?? columns[0];
  if (!col) throw new BadRequestError("O projeto não tem colunas", "NO_COLUMNS");
  return col;
}

/** Coluna para onde volta uma tarefa restaurada/desarquivada (a sua, se ainda existir). */
async function columnForReturn(tx: Queryable, task: Task): Promise<string> {
  return pickColumn(await columnRepository.list(task.projectId, tx), { status: task.status, current: task.columnId }).id;
}

/**
 * Reposiciona a tarefa no quadro e grava somente as linhas cujo status/coluna/posição mudaram.
 * Deve rodar dentro de transação, após `lockProject`.
 */
async function reorder(tx: Queryable, projectId: string, moving: Task, toColumnId: string, toIndex: number) {
  const columns = await columnRepository.list(projectId, tx);
  const before = (await taskRepository.listBoard(projectId, tx)).map(toTaskDTO);
  const base = before.some((t) => t.id === moving.id)
    ? before
    : [...before, { ...moving, columnId: toColumnId, position: Number.MAX_SAFE_INTEGER }];
  const after = moveToColumn(base, moving.id, toColumnId, toIndex, columns);

  for (const task of diffColumnOrder(before, after)) {
    if (task.id === moving.id) {
      await taskRepository.update(
        task.id,
        {
          position: task.position,
          status: task.status,
          columnId: task.columnId,
          completedAt: resolveCompletedAt(moving.status, task.status, moving.completedAt),
        },
        tx,
      );
    } else {
      await taskRepository.setPosition(task.id, task.position, tx);
    }
  }
}

async function insertTask(ctx: TaskContext, data: CreateTaskData & { projectId: string }, tx: Queryable): Promise<string> {
  let position: number;
  let status = data.status;
  let columnId: string | null = null;
  if (data.parentId) {
    const parent = await loadOrFail(ctx, data.parentId, tx);
    if (parent.parentId) throw new BadRequestError("Subtarefas não podem ter subtarefas");
    data = { ...data, projectId: parent.projectId };
    position = await taskRepository.countSubtasks(parent.id, tx);
  } else {
    const column = pickColumn(await columnRepository.list(data.projectId, tx), { columnId: data.columnId, status: data.status });
    columnId = column.id;
    status = column.category;
    position = await taskRepository.countInColumn(column.id, tx);
  }
  const id = await taskRepository.create(
    {
      workspaceId: ctx.workspaceId,
      projectId: data.projectId,
      columnId,
      parentId: data.parentId,
      userId: ctx.userId,
      title: data.title,
      description: data.description,
      priority: data.priority,
      status,
      position,
      startDate: data.startDate,
      dueDate: data.dueDate,
      dueTime: data.dueTime,
      estimateMinutes: data.estimateMinutes,
      recurrence: data.recurrence,
      completedAt: status === "done" ? new Date() : null,
    },
    tx,
  );
  if (data.assigneeIds?.length) {
    await taskRepository.setAssignees(id, await workspaceRepository.filterMembers(ctx.workspaceId, data.assigneeIds, tx), tx);
  }
  if (data.labelIds?.length) await taskRepository.setLabels(id, await validLabels(ctx.workspaceId, data.labelIds, tx), tx);
  // Quem cria acompanha a tarefa (recebe notificações de comentários e mudanças).
  await tx.query(`INSERT INTO task_followers (task_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [id, ctx.userId]);
  return id;
}

const SEARCH_EXPR = `translate(lower(t.title || ' ' || coalesce(t.description, '')),
  'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn')`;

export const taskService = {
  async list(ctx: TaskContext, query: Partial<TaskQuery> = {}): Promise<Task[]> {
    const params: unknown[] = [ctx.workspaceId];
    const where = ["t.workspace_id = $1"];
    const add = (sql: string, ...values: unknown[]) => {
      let out = sql;
      for (const v of values) {
        params.push(v);
        out = out.replace("?", `$${params.length}`);
      }
      where.push(out);
    };

    const view = query.view ?? "active";
    if (view === "active") where.push("t.archived_at IS NULL AND t.deleted_at IS NULL");
    if (view === "archived") where.push("t.archived_at IS NOT NULL AND t.deleted_at IS NULL");
    if (view === "trash") where.push("t.deleted_at IS NOT NULL");
    // Tarefas de projetos excluídos/arquivados não aparecem nas listas ativas.
    where.push(`EXISTS (SELECT 1 FROM projects p WHERE p.id = t.project_id AND p.deleted_at IS NULL)`);
    if (!query.includeSubtasks) where.push("t.parent_id IS NULL");
    if (query.projectId) add("t.project_id = ?", query.projectId);
    if (query.status) add("t.status = ?", query.status);
    if (query.priority) add("t.priority = ?", query.priority);
    if (query.assigneeId) {
      add("EXISTS (SELECT 1 FROM task_assignees a WHERE a.task_id = t.id AND a.user_id = ?)", query.assigneeId === "me" ? ctx.userId : query.assigneeId);
    }
    if (query.labelId) add("EXISTS (SELECT 1 FROM task_labels l WHERE l.task_id = t.id AND l.label_id = ?)", query.labelId);
    if (query.due === "overdue") where.push("t.due_date < current_date AND t.status <> 'done'");
    if (query.due === "today") where.push("t.due_date = current_date");
    if (query.due === "week") where.push("t.due_date BETWEEN current_date AND current_date + 7");
    if (query.due === "none") where.push("t.due_date IS NULL");
    if (query.from) add("t.due_date >= ?::date", query.from);
    if (query.to) add("t.due_date <= ?::date", query.to);
    if (query.search) add(`${SEARCH_EXPR} LIKE ?`, `%${normalizeText(query.search).replace(/[%_\\]/g, "\\$&")}%`);

    const order =
      query.projectId && view === "active"
        ? "CASE t.status WHEN 'todo' THEN 0 WHEN 'doing' THEN 1 ELSE 2 END, t.position, t.created_at"
        : view === "trash"
          ? "t.deleted_at DESC"
          : "t.due_date NULLS LAST, CASE t.priority WHEN 'urgente' THEN 0 WHEN 'alta' THEN 1 WHEN 'media' THEN 2 ELSE 3 END, t.created_at";

    const { rows } = await db.query<TaskRow>(`${TASK_SELECT} WHERE ${where.join(" AND ")} ORDER BY ${order} LIMIT 1000`, params);
    return rows.map(toTaskDTO);
  },

  async get(ctx: TaskContext, id: string): Promise<TaskDetail> {
    const task = await loadOrFail(ctx, id, db, true);
    const [checklist, followers, deps, subtasks] = await Promise.all([
      db.query<ChecklistItem>(`SELECT id, content, done, position FROM checklist_items WHERE task_id = $1 ORDER BY position, created_at`, [id]),
      db.query<{ user_id: string }>(`SELECT user_id FROM task_followers WHERE task_id = $1`, [id]),
      db.query<{ depends_on_id: string }>(`SELECT depends_on_id FROM task_dependencies WHERE task_id = $1`, [id]),
      taskRepository.subtasks(id),
    ]);
    return {
      ...task,
      checklist: checklist.rows,
      followerIds: followers.rows.map((r) => r.user_id),
      dependencyIds: deps.rows.map((r) => r.depends_on_id),
      subtasks: subtasks.map(toTaskDTO),
    };
  },

  /** Novas tarefas entram no final da coluna escolhida (ou da lista de subtarefas). */
  async create(ctx: TaskContext, data: CreateTaskData & { projectId: string }): Promise<Task> {
    assertCan(ctx, "tasks.create");
    const task = await db.transaction(async (tx) => {
      await assertProject(ctx, data.projectId, tx);
      await taskRepository.lockProject(data.projectId, tx);
      const id = await insertTask(ctx, data, tx);
      const created = await loadOrFail(ctx, id, tx);
      await activityRepository.log(
        { workspaceId: ctx.workspaceId, actorId: ctx.userId, entityType: "task", entityId: id, projectId: created.projectId, action: "task.created", data: { title: created.title } },
        tx,
      );
      return created;
    });
    await emit("task.created", { task, actorId: ctx.userId, automation: ctx.automation });
    return task;
  },

  /** Importa várias tarefas de forma atômica, mantendo a ordem. */
  async importMany(ctx: TaskContext, projectId: string, tasks: CreateTaskData[]): Promise<Task[]> {
    assertCan(ctx, "tasks.create");
    return db.transaction(async (tx) => {
      await assertProject(ctx, projectId, tx);
      await taskRepository.lockProject(projectId, tx);
      const created: Task[] = [];
      for (const data of tasks) created.push(await loadOrFail(ctx, await insertTask(ctx, { ...data, parentId: null, projectId }, tx), tx));
      return created;
    });
  },

  /**
   * Atualiza apenas os campos enviados. `status`/`position` reposicionam no quadro
   * (sem `position`, vai para o final da nova coluna). `expectedUpdatedAt` detecta conflito de edição.
   */
  async update(ctx: TaskContext, id: string, data: UpdateTaskData): Promise<Task> {
    const result = await db.transaction(async (tx) => {
      const snapshot = await loadOrFail(ctx, id, tx);
      await taskRepository.lockProject(snapshot.projectId, tx);
      const current = await loadOrFail(ctx, id, tx);
      assertCanEdit(ctx, current);

      const { status: requestedStatus, columnId, position, projectId, assigneeIds, labelIds, expectedUpdatedAt, ...fields } = data;
      if (expectedUpdatedAt && new Date(expectedUpdatedAt).getTime() !== new Date(current.updatedAt).getTime()) {
        throw new ConflictError("Esta tarefa foi alterada por outra pessoa. Recarregue para ver a versão mais recente.", "EDIT_CONFLICT");
      }

      const changes: string[] = Object.entries(fields)
        .filter(([key, value]) => value !== undefined && value !== current[key as keyof Task])
        .map(([key]) => key);

      // Status efetivo: a categoria da coluna de destino (coluna tem precedência sobre status).
      let status = requestedStatus;
      if (projectId && projectId !== current.projectId) {
        if (!can(ctx.role, "tasks.edit")) throw new ForbiddenError();
        if (current.parentId) throw new BadRequestError("Mova a tarefa principal para mudar o projeto");
        await assertProject(ctx, projectId, tx);
        await taskRepository.lockProject(projectId, tx);
        const target = pickColumn(await columnRepository.list(projectId, tx), { columnId, status: requestedStatus ?? current.status });
        status = target.category;
        await taskRepository.update(id, { projectId }, tx);
        await tx.query(`UPDATE tasks SET project_id = $1 WHERE parent_id = $2`, [projectId, id]);
        await compactBoard(tx, current.projectId);
        await reorder(tx, projectId, { ...current, projectId, columnId: null }, target.id, position ?? Number.MAX_SAFE_INTEGER);
        changes.push("projectId");
      } else if (!current.parentId && (columnId !== undefined || (requestedStatus !== undefined && requestedStatus !== current.status) || position !== undefined)) {
        const columns = await columnRepository.list(current.projectId, tx);
        const target = pickColumn(columns, { columnId, status: requestedStatus ?? current.status, current: current.columnId });
        status = target.category;
        if (columnId !== undefined && columnId !== current.columnId) changes.push("columnId");
        await reorder(tx, current.projectId, current, target.id, position ?? (target.id === current.columnId ? current.position : Number.MAX_SAFE_INTEGER));
      } else if (current.parentId && requestedStatus !== undefined && requestedStatus !== current.status) {
        await taskRepository.update(id, { status: requestedStatus, completedAt: resolveCompletedAt(current.status, requestedStatus, current.completedAt) }, tx);
      }
      if (status !== undefined && status !== current.status) changes.push("status");

      const fieldChanges = fields as TaskChanges;
      const hasFieldChanges = Object.values(fieldChanges).some((v) => v !== undefined);
      if (hasFieldChanges) await taskRepository.update(id, fieldChanges, tx);

      if (assigneeIds) {
        await taskRepository.setAssignees(id, await workspaceRepository.filterMembers(ctx.workspaceId, assigneeIds, tx), tx);
        changes.push("assigneeIds");
      }
      if (labelIds) {
        await taskRepository.setLabels(id, await validLabels(ctx.workspaceId, labelIds, tx), tx);
        changes.push("labelIds");
      }
      if ((assigneeIds || labelIds) && !hasFieldChanges) await taskRepository.update(id, {}, tx);

      // Tarefa recorrente concluída → cria a próxima ocorrência.
      let nextId: string | null = null;
      if (status === "done" && current.status !== "done" && current.recurrence && current.dueDate && !current.parentId) {
        nextId = await insertTask(
          ctx,
          {
            title: current.title,
            description: current.description,
            priority: current.priority,
            status: "todo",
            dueDate: nextOccurrence(current.dueDate, current.recurrence),
            startDate: current.startDate ? nextOccurrence(current.startDate, current.recurrence) : null,
            dueTime: current.dueTime,
            estimateMinutes: current.estimateMinutes,
            recurrence: current.recurrence,
            parentId: null,
            projectId: current.projectId,
            assigneeIds: current.assigneeIds,
            labelIds: current.labelIds,
          },
          tx,
        );
      }

      const after = await loadOrFail(ctx, id, tx);
      const meaningful = changes.filter((c) => c !== "position");
      if (meaningful.length) {
        await activityRepository.log(
          {
            workspaceId: ctx.workspaceId, actorId: ctx.userId, entityType: "task", entityId: id, projectId: after.projectId,
            action: status === "done" && current.status !== "done" ? "task.completed" : "task.updated",
            data: { title: after.title, changes: meaningful, ...(status && status !== current.status && { from: current.status, to: status }) },
          },
          tx,
        );
      }
      return { before: current, after, next: nextId ? await loadOrFail(ctx, nextId, tx) : null };
    });

    await emit("task.updated", { before: result.before, after: result.after, actorId: ctx.userId, automation: ctx.automation });
    if (result.next) await emit("task.created", { task: result.next, actorId: ctx.userId, automation: ctx.automation });
    return result.after;
  },

  /** Envia para a lixeira (restaurável). Subtarefas vão junto. */
  async remove(ctx: TaskContext, id: string): Promise<void> {
    assertCan(ctx, "tasks.delete");
    const task = await db.transaction(async (tx) => {
      const current = await loadOrFail(ctx, id, tx);
      await taskRepository.lockProject(current.projectId, tx);
      const now = new Date();
      await taskRepository.update(id, { deletedAt: now }, tx);
      await tx.query(`UPDATE tasks SET deleted_at = $2 WHERE parent_id = $1 AND deleted_at IS NULL`, [id, now]);
      await compactBoard(tx, current.projectId);
      await activityRepository.log(
        { workspaceId: ctx.workspaceId, actorId: ctx.userId, entityType: "task", entityId: id, projectId: current.projectId, action: "task.deleted", data: { title: current.title } },
        tx,
      );
      return current;
    });
    await emit("task.deleted", { task, actorId: ctx.userId, permanent: false });
  },

  async restore(ctx: TaskContext, id: string): Promise<Task> {
    assertCan(ctx, "tasks.delete");
    const task = await db.transaction(async (tx) => {
      const current = await loadOrFail(ctx, id, tx, true);
      if (!current.deletedAt) throw new BadRequestError("A tarefa não está na lixeira");
      await assertProject(ctx, current.projectId, tx);
      await taskRepository.lockProject(current.projectId, tx);
      await tx.query(`UPDATE tasks SET deleted_at = NULL WHERE parent_id = $1 AND deleted_at = $2`, [id, current.deletedAt]);
      await taskRepository.update(id, { deletedAt: null }, tx);
      if (!current.parentId && !current.archivedAt) {
        await reorder(tx, current.projectId, { ...current, deletedAt: null }, await columnForReturn(tx, current), Number.MAX_SAFE_INTEGER);
      }
      await activityRepository.log(
        { workspaceId: ctx.workspaceId, actorId: ctx.userId, entityType: "task", entityId: id, projectId: current.projectId, action: "task.restored", data: { title: current.title } },
        tx,
      );
      return loadOrFail(ctx, id, tx);
    });
    await emit("task.restored", { task, actorId: ctx.userId });
    return task;
  },

  /** Exclusão definitiva: só a partir da lixeira. */
  async destroy(ctx: TaskContext, id: string): Promise<void> {
    assertCan(ctx, "tasks.delete");
    const task = await loadOrFail(ctx, id, db, true);
    if (!task.deletedAt) throw new BadRequestError("Envie a tarefa para a lixeira antes de excluí-la definitivamente");
    await taskRepository.delete(id);
    await emit("task.deleted", { task, actorId: ctx.userId, permanent: true });
  },

  async setArchived(ctx: TaskContext, id: string, archived: boolean): Promise<Task> {
    const result = await db.transaction(async (tx) => {
      const current = await loadOrFail(ctx, id, tx);
      assertCanEdit(ctx, current);
      await taskRepository.lockProject(current.projectId, tx);
      if (Boolean(current.archivedAt) === archived) return { before: current, after: current };
      await taskRepository.update(id, { archivedAt: archived ? new Date() : null }, tx);
      if (!current.parentId) {
        if (archived) await compactBoard(tx, current.projectId);
        else await reorder(tx, current.projectId, { ...current, archivedAt: null }, await columnForReturn(tx, current), Number.MAX_SAFE_INTEGER);
      }
      await activityRepository.log(
        { workspaceId: ctx.workspaceId, actorId: ctx.userId, entityType: "task", entityId: id, projectId: current.projectId, action: archived ? "task.archived" : "task.unarchived", data: { title: current.title } },
        tx,
      );
      return { before: current, after: await loadOrFail(ctx, id, tx) };
    });
    await emit("task.updated", { ...result, actorId: ctx.userId, automation: ctx.automation });
    return result.after;
  },

  /** Duplica com checklist, etiquetas, responsáveis e subtarefas (sem comentários). */
  async duplicate(ctx: TaskContext, id: string): Promise<Task> {
    assertCan(ctx, "tasks.create");
    const task = await db.transaction(async (tx) => {
      const source = await this.get(ctx, id);
      await taskRepository.lockProject(source.projectId, tx);
      const copyData = (t: Task, parentId: string | null, title: string): CreateTaskData & { projectId: string } => ({
        title,
        description: t.description,
        priority: t.priority,
        status: parentId ? t.status : "todo",
        dueDate: t.dueDate,
        startDate: t.startDate,
        dueTime: t.dueTime,
        estimateMinutes: t.estimateMinutes,
        recurrence: t.recurrence,
        parentId,
        projectId: t.projectId,
        assigneeIds: t.assigneeIds,
        labelIds: t.labelIds,
      });
      const title = `${source.title} (cópia)`.slice(0, 120);
      const newId = await insertTask(ctx, copyData(source, source.parentId, title), tx);
      for (const item of source.checklist) {
        await tx.query(`INSERT INTO checklist_items (task_id, content, done, position) VALUES ($1, $2, false, $3)`, [newId, item.content, item.position]);
      }
      for (const sub of source.subtasks) await insertTask(ctx, copyData(sub, newId, sub.title), tx);
      return loadOrFail(ctx, newId, tx);
    });
    await emit("task.created", { task, actorId: ctx.userId, automation: ctx.automation });
    return task;
  },

  /** Ações em massa: cada item reaproveita a operação individual (mesmas regras e permissões). */
  async bulk(ctx: TaskContext, input: BulkTaskInput) {
    const results = { ok: 0, failed: [] as Array<{ id: string; message: string }> };
    for (const id of new Set(input.ids)) {
      try {
        if (input.action === "status" && input.status) await this.update(ctx, id, { status: input.status });
        else if (input.action === "priority" && input.priority) await this.update(ctx, id, { priority: input.priority });
        else if (input.action === "assign" && input.assigneeId) {
          const t = await loadOrFail(ctx, id);
          await this.update(ctx, id, { assigneeIds: [...new Set([...t.assigneeIds, input.assigneeId])] });
        } else if (input.action === "archive") await this.setArchived(ctx, id, true);
        else if (input.action === "delete") await this.remove(ctx, id);
        else throw new BadRequestError("Parâmetros da ação ausentes");
        results.ok += 1;
      } catch (error) {
        results.failed.push({ id, message: error instanceof Error ? error.message : "Erro" });
      }
    }
    return results;
  },

  // ------------------------------------------------------------ checklist
  async addChecklistItem(ctx: TaskContext, taskId: string, content: string): Promise<ChecklistItem> {
    const task = await loadOrFail(ctx, taskId);
    assertCanEdit(ctx, task);
    const { rows } = await db.query<ChecklistItem>(
      `INSERT INTO checklist_items (task_id, content, position)
       VALUES ($1, $2, (SELECT count(*) FROM checklist_items WHERE task_id = $1)) RETURNING id, content, done, position`,
      [taskId, content],
    );
    await taskRepository.update(taskId, {});
    return rows[0];
  },

  async updateChecklistItem(ctx: TaskContext, taskId: string, itemId: string, data: { content?: string; done?: boolean; position?: number }) {
    const task = await loadOrFail(ctx, taskId);
    assertCanEdit(ctx, task);
    const { rows } = await db.query<ChecklistItem>(
      `UPDATE checklist_items SET content = COALESCE($3, content), done = COALESCE($4, done), position = COALESCE($5, position)
       WHERE id = $1 AND task_id = $2 RETURNING id, content, done, position`,
      [itemId, taskId, data.content ?? null, data.done ?? null, data.position ?? null],
    );
    if (!rows[0]) throw new NotFoundError("Item");
    await taskRepository.update(taskId, {});
    return rows[0];
  },

  async removeChecklistItem(ctx: TaskContext, taskId: string, itemId: string) {
    const task = await loadOrFail(ctx, taskId);
    assertCanEdit(ctx, task);
    const { rows } = await db.query(`DELETE FROM checklist_items WHERE id = $1 AND task_id = $2 RETURNING id`, [itemId, taskId]);
    if (!rows[0]) throw new NotFoundError("Item");
    await taskRepository.update(taskId, {});
  },

  // ------------------------------------------------------------ dependências e seguidores
  async addDependency(ctx: TaskContext, taskId: string, dependsOnId: string) {
    const [task] = await Promise.all([loadOrFail(ctx, taskId), loadOrFail(ctx, dependsOnId)]);
    assertCanEdit(ctx, task);
    if (taskId === dependsOnId) throw new BadRequestError("Uma tarefa não pode depender dela mesma");
    // Impede ciclos: dependsOnId não pode (direta ou indiretamente) depender de taskId.
    const { rows } = await db.query<{ cycle: boolean }>(
      `WITH RECURSIVE chain(id) AS (
         SELECT depends_on_id FROM task_dependencies WHERE task_id = $1
         UNION SELECT d.depends_on_id FROM task_dependencies d JOIN chain c ON d.task_id = c.id
       ) SELECT EXISTS (SELECT 1 FROM chain WHERE id = $2) AS cycle`,
      [dependsOnId, taskId],
    );
    if (rows[0].cycle) throw new BadRequestError("Essa dependência criaria um ciclo");
    await db.query(`INSERT INTO task_dependencies (task_id, depends_on_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [taskId, dependsOnId]);
  },

  async removeDependency(ctx: TaskContext, taskId: string, dependsOnId: string) {
    assertCanEdit(ctx, await loadOrFail(ctx, taskId));
    await db.query(`DELETE FROM task_dependencies WHERE task_id = $1 AND depends_on_id = $2`, [taskId, dependsOnId]);
  },

  async setFollowing(ctx: TaskContext, taskId: string, follow: boolean) {
    await loadOrFail(ctx, taskId);
    if (follow) await db.query(`INSERT INTO task_followers (task_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [taskId, ctx.userId]);
    else await db.query(`DELETE FROM task_followers WHERE task_id = $1 AND user_id = $2`, [taskId, ctx.userId]);
  },

  loadOrFail,
};
