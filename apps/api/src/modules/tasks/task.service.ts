import type { z } from "zod";
import {
  diffOrder,
  filterTasks,
  moveTask,
  removeTask,
  sortTasks,
  type createTaskSchema,
  type Task,
  type TaskQuery,
  type TaskStatus,
  type updateTaskSchema,
} from "@andamo/shared";
import { db, type Queryable } from "../../db";
import { NotFoundError } from "../../shared/errors";
import { toTaskDTO } from "./task.mapper";
import { taskRepository } from "./task.repository";

type CreateTaskData = z.output<typeof createTaskSchema>;
type UpdateTaskData = z.output<typeof updateTaskSchema>;

/**
 * Regra de `completedAt`: preenchido ao entrar em "Concluído", limpo ao sair,
 * preservado enquanto a tarefa continua concluída.
 */
function resolveCompletedAt(from: TaskStatus, to: TaskStatus, current: string | null) {
  if (to !== "done") return null;
  return from === "done" && current ? new Date(current) : new Date();
}

async function findOwnedOrFail(userId: string, taskId: string, tx: Queryable = db) {
  const task = await taskRepository.findOwned(taskId, userId, tx);
  if (!task) throw new NotFoundError("Tarefa");
  return toTaskDTO(task);
}

/**
 * Reposiciona a tarefa e grava somente as linhas cujo status/posição mudaram.
 * Deve rodar dentro de transação, após `lockByUser`.
 */
async function reorder(
  tx: Queryable,
  userId: string,
  moving: Task,
  toStatus: TaskStatus,
  toIndex: number,
) {
  const before = (await taskRepository.listByUser(userId, tx)).map(toTaskDTO);
  const after = moveTask(before, moving.id, toStatus, toIndex);

  for (const task of diffOrder(before, after)) {
    const isMoving = task.id === moving.id;
    await taskRepository.update(
      task.id,
      isMoving
        ? {
            position: task.position,
            status: task.status,
            completedAt: resolveCompletedAt(moving.status, task.status, moving.completedAt),
          }
        : { position: task.position },
      tx,
    );
  }
}

export const taskService = {
  async list(userId: string, query: TaskQuery = {}): Promise<Task[]> {
    const tasks = sortTasks((await taskRepository.listByUser(userId)).map(toTaskDTO));
    const filtered = filterTasks(tasks, { search: query.search, priority: query.priority });
    return query.status ? filtered.filter((t) => t.status === query.status) : filtered;
  },

  async get(userId: string, taskId: string): Promise<Task> {
    return findOwnedOrFail(userId, taskId);
  },

  /** Novas tarefas entram no final da coluna escolhida. */
  async create(userId: string, data: CreateTaskData): Promise<Task> {
    const row = await db.transaction(async (tx) => {
      await taskRepository.lockByUser(userId, tx);
      const position = await taskRepository.countInColumn(userId, data.status, tx);
      return taskRepository.create(
        {
          userId,
          ...data,
          position,
          completedAt: data.status === "done" ? new Date() : null,
        },
        tx,
      );
    });
    return toTaskDTO(row);
  },

  /** Importa várias tarefas (ex.: do localStorage) de forma atômica, mantendo a ordem. */
  async importMany(userId: string, tasks: CreateTaskData[]): Promise<Task[]> {
    const rows = await db.transaction(async (tx) => {
      await taskRepository.lockByUser(userId, tx);
      const next: Partial<Record<TaskStatus, number>> = {};
      const created = [];
      for (const data of tasks) {
        next[data.status] ??= await taskRepository.countInColumn(userId, data.status, tx);
        created.push(
          await taskRepository.create(
            {
              userId,
              ...data,
              position: next[data.status]!++,
              completedAt: data.status === "done" ? new Date() : null,
            },
            tx,
          ),
        );
      }
      return created;
    });
    return rows.map(toTaskDTO);
  },

  /**
   * Atualiza apenas os campos enviados. Se `status` e/ou `position` vierem,
   * a tarefa é reposicionada (sem `position`, vai para o final da nova coluna).
   */
  async update(userId: string, taskId: string, data: UpdateTaskData): Promise<Task> {
    const row = await db.transaction(async (tx) => {
      await taskRepository.lockByUser(userId, tx);
      const current = await findOwnedOrFail(userId, taskId, tx);
      const { status, position, ...fields } = data;

      const statusChanged = status !== undefined && status !== current.status;
      if (statusChanged || position !== undefined) {
        const toStatus = status ?? current.status;
        const toIndex = position ?? Number.MAX_SAFE_INTEGER;
        await reorder(tx, userId, current, toStatus, toIndex);
      }

      return taskRepository.update(taskId, fields, tx);
    });
    return toTaskDTO(row);
  },

  /** Exclui e compacta as posições da coluna. */
  async remove(userId: string, taskId: string): Promise<void> {
    await db.transaction(async (tx) => {
      await taskRepository.lockByUser(userId, tx);
      await findOwnedOrFail(userId, taskId, tx);
      const before = (await taskRepository.listByUser(userId, tx)).map(toTaskDTO);

      await taskRepository.delete(taskId, tx);

      for (const task of diffOrder(before, removeTask(before, taskId))) {
        await taskRepository.update(task.id, { position: task.position }, tx);
      }
    });
  },
};
