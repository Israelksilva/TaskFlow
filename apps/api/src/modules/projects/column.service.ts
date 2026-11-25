import type { BoardColumn, TaskStatus } from "@andamo/shared";
import { db as defaultDb, type Queryable } from "../../db";
import { emit } from "../../events/bus";
import { BadRequestError, NotFoundError } from "../../shared/errors";
import { activityRepository } from "../activity/activity.repository";
import { COLUMN_SELECT, columnRepository, toColumnDTO, type ColumnRow } from "./column.repository";
import { projectAccess, type ProjectContext } from "./project.service";

async function findColumn(projectId: string, columnId: string, tx: Queryable): Promise<BoardColumn> {
  const { rows } = await tx.query<ColumnRow>(`${COLUMN_SELECT} WHERE id = $1 AND project_id = $2`, [columnId, projectId]);
  if (!rows[0]) throw new NotFoundError("Coluna");
  return toColumnDTO(rows[0]);
}

/** Ao mudar a categoria, as tarefas da coluna passam a ter o novo status (e `completedAt` coerente). */
async function syncTaskStatus(columnId: string, category: TaskStatus, tx: Queryable) {
  await tx.query(
    `UPDATE tasks SET status = $2, updated_at = now(),
       completed_at = CASE WHEN $2 = 'done' THEN COALESCE(completed_at, now()) ELSE NULL END
     WHERE column_id = $1 AND status <> $2`,
    [columnId, category],
  );
}

async function normalizePositions(projectId: string, ids: string[], tx: Queryable) {
  for (const [position, id] of ids.entries()) {
    await tx.query(`UPDATE project_columns SET position = $3 WHERE id = $1 AND project_id = $2`, [id, projectId, position]);
  }
}

async function changed(ctx: ProjectContext, projectId: string, action: string, name: string) {
  await activityRepository.log({
    workspaceId: ctx.workspaceId, actorId: ctx.userId, entityType: "project", entityId: projectId, projectId,
    action, data: { column: name },
  });
  const project = await projectAccess.get(ctx, projectId);
  await emit("project.updated", { before: project, after: project, actorId: ctx.userId });
}

export const columnService = {
  async list(ctx: ProjectContext, projectId: string): Promise<BoardColumn[]> {
    await projectAccess.get(ctx, projectId);
    return columnRepository.list(projectId);
  },

  async create(ctx: ProjectContext, projectId: string, data: { name: string; category: TaskStatus; wipLimit?: number | null; color?: string | null }) {
    await projectAccess.assertCanManageById(ctx, projectId);
    const column = await defaultDb.transaction(async (tx) => {
      const count = (await columnRepository.list(projectId, tx)).length;
      if (count >= 20) throw new BadRequestError("Um quadro pode ter no máximo 20 colunas");
      const { rows } = await tx.query<ColumnRow>(
        `INSERT INTO project_columns (project_id, name, category, position, wip_limit, color)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, project_id, name, category, position, wip_limit, color`,
        [projectId, data.name, data.category, count, data.wipLimit ?? null, data.color ?? null],
      );
      return toColumnDTO(rows[0]);
    });
    await changed(ctx, projectId, "column.created", column.name);
    return column;
  },

  async update(
    ctx: ProjectContext,
    projectId: string,
    columnId: string,
    data: { name?: string; category?: TaskStatus; wipLimit?: number | null; color?: string | null },
  ) {
    await projectAccess.assertCanManageById(ctx, projectId);
    const column = await defaultDb.transaction(async (tx) => {
      const current = await findColumn(projectId, columnId, tx);
      const next = { ...current, ...Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)) } as BoardColumn;
      await tx.query(`UPDATE project_columns SET name = $2, category = $3, wip_limit = $4, color = $5 WHERE id = $1`, [
        columnId,
        next.name,
        next.category,
        next.wipLimit,
        next.color,
      ]);
      if (next.category !== current.category) await syncTaskStatus(columnId, next.category, tx);
      return next;
    });
    await changed(ctx, projectId, "column.updated", column.name);
    return column;
  },

  async reorder(ctx: ProjectContext, projectId: string, ids: string[]) {
    await projectAccess.assertCanManageById(ctx, projectId);
    await defaultDb.transaction(async (tx) => {
      const current = await columnRepository.list(projectId, tx);
      const known = new Set(current.map((c) => c.id));
      if (ids.length !== current.length || !ids.every((id) => known.has(id)) || new Set(ids).size !== ids.length) {
        throw new BadRequestError("Envie todas as colunas do quadro, sem repetir");
      }
      await normalizePositions(projectId, ids, tx);
    });
    await changed(ctx, projectId, "column.reordered", "");
    return columnRepository.list(projectId);
  },

  /** Exclui a coluna movendo suas tarefas (ativas, arquivadas e na lixeira) para outra. */
  async remove(ctx: ProjectContext, projectId: string, columnId: string, moveToColumnId?: string) {
    await projectAccess.assertCanManageById(ctx, projectId);
    const removed = await defaultDb.transaction(async (tx) => {
      await tx.query("SELECT id FROM projects WHERE id = $1 FOR UPDATE", [projectId]);
      const column = await findColumn(projectId, columnId, tx);
      const columns = await columnRepository.list(projectId, tx);
      if (columns.length <= 1) throw new BadRequestError("O quadro precisa ter ao menos uma coluna");
      const { rows } = await tx.query<{ n: number }>(`SELECT count(*)::int AS n FROM tasks WHERE column_id = $1`, [columnId]);
      if (rows[0].n > 0) {
        if (!moveToColumnId || moveToColumnId === columnId) {
          throw new BadRequestError("Escolha para qual coluna as tarefas serão movidas", "COLUMN_NOT_EMPTY");
        }
        const target = await findColumn(projectId, moveToColumnId, tx);
        // Vão para o final da coluna de destino, mantendo a ordem relativa.
        await tx.query(
          `UPDATE tasks t SET column_id = $2, position = s.base + s.rn, updated_at = now()
           FROM (
             SELECT id, row_number() OVER (ORDER BY position, created_at) - 1 AS rn,
               (SELECT count(*) FROM tasks WHERE column_id = $2 AND parent_id IS NULL AND deleted_at IS NULL AND archived_at IS NULL) AS base
             FROM tasks WHERE column_id = $1
           ) s WHERE t.id = s.id`,
          [columnId, target.id],
        );
        await syncTaskStatus(target.id, target.category, tx);
      }
      await tx.query(`DELETE FROM project_columns WHERE id = $1`, [columnId]);
      await normalizePositions(projectId, columns.filter((c) => c.id !== columnId).map((c) => c.id), tx);
      return column;
    });
    await changed(ctx, projectId, "column.deleted", removed.name);
  },
};
