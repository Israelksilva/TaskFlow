import type { z } from "zod";
import { can, PLANS, type createProjectSchema, type PlanId, type Project, type Role, type updateProjectSchema } from "@andamo/shared";
import { db, type Queryable } from "../../db";
import { emit } from "../../events/bus";
import { toISO } from "../../shared/dates";
import { BadRequestError, ForbiddenError, NotFoundError, PlanLimitError } from "../../shared/errors";
import { activityRepository } from "../activity/activity.repository";
import { columnRepository } from "./column.repository";
import { workspaceRepository } from "../workspaces/workspace.repository";

type CreateData = z.output<typeof createProjectSchema>;
type UpdateData = z.output<typeof updateProjectSchema>;

export interface ProjectContext {
  workspaceId: string;
  userId: string;
  role: Role;
  plan: PlanId;
}

interface ProjectRow {
  id: string;
  workspace_id: string;
  team_id: string | null;
  name: string;
  description: string | null;
  goal: string | null;
  icon: string;
  color: string;
  status: Project["status"];
  priority: Project["priority"];
  start_date: string | null;
  due_date: string | null;
  owner_id: string | null;
  created_by: string | null;
  is_default: boolean;
  is_template: boolean;
  archived_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
  task_count: number;
  done_count: number;
  overdue_count: number;
}

const SELECT = `SELECT p.id, p.workspace_id, p.team_id, p.name, p.description, p.goal, p.icon, p.color, p.status, p.priority,
    p.start_date::text AS start_date, p.due_date::text AS due_date, p.owner_id, p.created_by, p.is_default, p.is_template,
    p.archived_at, p.created_at, p.updated_at,
    (SELECT count(*)::int FROM tasks t WHERE t.project_id = p.id AND t.parent_id IS NULL AND t.deleted_at IS NULL AND t.archived_at IS NULL) AS task_count,
    (SELECT count(*)::int FROM tasks t WHERE t.project_id = p.id AND t.parent_id IS NULL AND t.deleted_at IS NULL AND t.archived_at IS NULL AND t.status = 'done') AS done_count,
    (SELECT count(*)::int FROM tasks t WHERE t.project_id = p.id AND t.parent_id IS NULL AND t.deleted_at IS NULL AND t.archived_at IS NULL
       AND t.status <> 'done' AND t.due_date < current_date) AS overdue_count
  FROM projects p`;

export const toProjectDTO = (r: ProjectRow): Project => ({
  id: r.id,
  workspaceId: r.workspace_id,
  teamId: r.team_id,
  name: r.name,
  description: r.description,
  goal: r.goal,
  icon: r.icon,
  color: r.color,
  status: r.status,
  priority: r.priority,
  startDate: r.start_date,
  dueDate: r.due_date,
  ownerId: r.owner_id,
  isDefault: r.is_default,
  isTemplate: r.is_template,
  archivedAt: r.archived_at ? toISO(r.archived_at) : null,
  createdAt: toISO(r.created_at),
  updatedAt: toISO(r.updated_at),
  taskCount: r.task_count,
  doneCount: r.done_count,
  overdueCount: r.overdue_count,
  progress: r.task_count ? Math.round((r.done_count / r.task_count) * 100) : 0,
});

async function findOrFail(ctx: ProjectContext, id: string, tx: Queryable = db): Promise<{ row: ProjectRow; dto: Project }> {
  const { rows } = await tx.query<ProjectRow>(`${SELECT} WHERE p.id = $1 AND p.workspace_id = $2 AND p.deleted_at IS NULL`, [
    id,
    ctx.workspaceId,
  ]);
  if (!rows[0]) throw new NotFoundError("Projeto");
  return { row: rows[0], dto: toProjectDTO(rows[0]) };
}

/** Gestores+ gerenciam qualquer projeto; membros, os que criaram ou dos quais são responsáveis. */
function assertCanManage(ctx: ProjectContext, row: ProjectRow) {
  if (can(ctx.role, "projects.manage")) return;
  if (can(ctx.role, "projects.create") && (row.created_by === ctx.userId || row.owner_id === ctx.userId)) return;
  throw new ForbiddenError();
}

async function assertWithinPlan(ctx: ProjectContext, tx: Queryable) {
  const limit = PLANS[ctx.plan].limits.projects;
  if (limit === null) return;
  const { rows } = await tx.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM projects WHERE workspace_id = $1 AND deleted_at IS NULL AND archived_at IS NULL AND NOT is_template`,
    [ctx.workspaceId],
  );
  if (rows[0].n >= limit) {
    throw new PlanLimitError(`O plano ${PLANS[ctx.plan].name} permite até ${limit} projetos ativos. Arquive um projeto ou faça upgrade.`);
  }
}

async function validateRefs(ctx: ProjectContext, data: { ownerId?: string | null; teamId?: string | null }, tx: Queryable) {
  if (data.ownerId && !(await workspaceRepository.filterMembers(ctx.workspaceId, [data.ownerId], tx)).length) {
    throw new BadRequestError("O responsável precisa ser membro do workspace");
  }
  if (data.teamId) {
    const { rows } = await tx.query(`SELECT id FROM teams WHERE id = $1 AND workspace_id = $2`, [data.teamId, ctx.workspaceId]);
    if (!rows[0]) throw new BadRequestError("Equipe inválida");
  }
}

/** Copia as tarefas principais (com checklist e etiquetas) de um projeto para outro. */
async function copyTasks(tx: Queryable, fromProjectId: string, toProjectId: string, userId: string, columnMap: Map<string, string>) {
  const { rows } = await tx.query<{ old_id: string; new_id: string; old_column: string | null }>(
    `WITH src AS (
       SELECT id, title, description, priority, status, position, start_date, due_date, due_time, estimate_minutes, recurrence, workspace_id, column_id
       FROM tasks WHERE project_id = $1 AND parent_id IS NULL AND deleted_at IS NULL AND archived_at IS NULL
     ), ins AS (
       INSERT INTO tasks (workspace_id, project_id, user_id, title, description, priority, status, position, start_date,
         due_date, due_time, estimate_minutes, recurrence, completed_at)
       SELECT workspace_id, $2, $3, title, description, priority, status, position, start_date, due_date, due_time,
         estimate_minutes, recurrence, CASE WHEN status = 'done' THEN now() END
       FROM src ORDER BY status, position
       RETURNING id, title, position, status
     )
     SELECT s.id AS old_id, i.id AS new_id, s.column_id AS old_column FROM src s JOIN ins i ON i.title = s.title AND i.position = s.position AND i.status = s.status`,
    [fromProjectId, toProjectId, userId],
  );
  for (const { old_id, new_id, old_column } of rows) {
    await tx.query(`UPDATE tasks SET column_id = $2 WHERE id = $1`, [new_id, old_column ? (columnMap.get(old_column) ?? null) : null]);
    await tx.query(
      `INSERT INTO checklist_items (task_id, content, done, position) SELECT $2, content, false, position FROM checklist_items WHERE task_id = $1`,
      [old_id, new_id],
    );
    await tx.query(`INSERT INTO task_labels (task_id, label_id) SELECT $2, label_id FROM task_labels WHERE task_id = $1`, [old_id, new_id]);
  }
}

export const projectService = {
  async list(ctx: ProjectContext, view: "active" | "archived" | "templates" = "active"): Promise<Project[]> {
    const filter =
      view === "archived" ? "p.archived_at IS NOT NULL" : view === "templates" ? "p.is_template" : "p.archived_at IS NULL AND NOT p.is_template";
    const { rows } = await db.query<ProjectRow>(
      `${SELECT} WHERE p.workspace_id = $1 AND p.deleted_at IS NULL AND ${filter} ORDER BY p.is_default DESC, p.created_at`,
      [ctx.workspaceId],
    );
    return rows.map(toProjectDTO);
  },

  async get(ctx: ProjectContext, id: string): Promise<Project> {
    return (await findOrFail(ctx, id)).dto;
  },

  async create(ctx: ProjectContext, data: CreateData): Promise<Project> {
    if (!can(ctx.role, "projects.create")) throw new ForbiddenError();
    const project = await db.transaction(async (tx) => {
      if (!data.isTemplate) await assertWithinPlan(ctx, tx);
      await validateRefs(ctx, data, tx);
      const { rows } = await tx.query<{ id: string }>(
        `INSERT INTO projects (workspace_id, team_id, name, description, goal, icon, color, status, priority, start_date, due_date,
           owner_id, created_by, is_template)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING id`,
        [
          ctx.workspaceId, data.teamId ?? null, data.name, data.description ?? null, data.goal ?? null, data.icon, data.color,
          data.status, data.priority, data.startDate ?? null, data.dueDate ?? null, data.ownerId ?? ctx.userId, ctx.userId, data.isTemplate,
        ],
      );
      if (data.templateId) {
        const template = await findOrFail(ctx, data.templateId, tx);
        const columnMap = await columnRepository.copy(template.row.id, rows[0].id, tx);
        await copyTasks(tx, template.row.id, rows[0].id, ctx.userId, columnMap);
      } else {
        await columnRepository.createDefaults(rows[0].id, tx);
      }
      await activityRepository.log(
        { workspaceId: ctx.workspaceId, actorId: ctx.userId, entityType: "project", entityId: rows[0].id, projectId: rows[0].id, action: "project.created", data: { name: data.name } },
        tx,
      );
      return (await findOrFail(ctx, rows[0].id, tx)).dto;
    });
    await emit("project.created", { project, actorId: ctx.userId });
    return project;
  },

  async update(ctx: ProjectContext, id: string, data: UpdateData): Promise<Project> {
    const result = await db.transaction(async (tx) => {
      const current = await findOrFail(ctx, id, tx);
      assertCanManage(ctx, current.row);
      await validateRefs(ctx, data, tx);
      const merged = { ...current.dto, ...Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)) } as Project;
      if (merged.startDate && merged.dueDate && merged.dueDate < merged.startDate) {
        throw new BadRequestError("A conclusão deve ser depois do início");
      }
      await tx.query(
        `UPDATE projects SET name = $3, description = $4, goal = $5, icon = $6, color = $7, status = $8, priority = $9,
           start_date = $10, due_date = $11, owner_id = $12, team_id = $13, is_template = $14, updated_at = now()
         WHERE id = $1 AND workspace_id = $2`,
        [
          id, ctx.workspaceId, merged.name, merged.description, merged.goal, merged.icon, merged.color, merged.status,
          merged.priority, merged.startDate, merged.dueDate, merged.ownerId, merged.teamId, merged.isTemplate,
        ],
      );
      const changes = Object.keys(data).filter((k) => data[k as keyof UpdateData] !== undefined);
      await activityRepository.log(
        {
          workspaceId: ctx.workspaceId, actorId: ctx.userId, entityType: "project", entityId: id, projectId: id,
          action: data.status === "completed" && current.dto.status !== "completed" ? "project.completed" : "project.updated",
          data: { name: merged.name, changes },
        },
        tx,
      );
      return { before: current.dto, after: (await findOrFail(ctx, id, tx)).dto };
    });
    await emit("project.updated", { ...result, actorId: ctx.userId });
    return result.after;
  },

  async duplicate(ctx: ProjectContext, id: string): Promise<Project> {
    const source = await this.get(ctx, id);
    return this.create(ctx, {
      name: `${source.name} (cópia)`.slice(0, 80),
      description: source.description,
      goal: source.goal,
      icon: source.icon,
      color: source.color,
      status: "active",
      priority: source.priority,
      startDate: source.startDate,
      dueDate: source.dueDate,
      ownerId: ctx.userId,
      teamId: source.teamId,
      isTemplate: false,
      templateId: source.id,
    });
  },

  async setArchived(ctx: ProjectContext, id: string, archived: boolean): Promise<Project> {
    const current = await findOrFail(ctx, id);
    assertCanManage(ctx, current.row);
    if (current.row.is_default && archived) throw new BadRequestError("O projeto padrão não pode ser arquivado");
    if (!archived) await assertWithinPlan(ctx, db);
    await db.query(`UPDATE projects SET archived_at = CASE WHEN $2 THEN now() END, updated_at = now() WHERE id = $1`, [id, archived]);
    await activityRepository.log({
      workspaceId: ctx.workspaceId, actorId: ctx.userId, entityType: "project", entityId: id, projectId: id,
      action: archived ? "project.archived" : "project.unarchived", data: { name: current.dto.name },
    });
    const after = await this.get(ctx, id);
    await emit("project.updated", { before: current.dto, after, actorId: ctx.userId });
    return after;
  },

  /** Exclusão (soft delete) autorizada: gestor+ ou o criador; o projeto padrão é protegido. */
  async remove(ctx: ProjectContext, id: string): Promise<void> {
    const current = await findOrFail(ctx, id);
    assertCanManage(ctx, current.row);
    if (current.row.is_default) throw new BadRequestError("O projeto padrão não pode ser excluído");
    await db.query(`UPDATE projects SET deleted_at = now(), updated_at = now() WHERE id = $1`, [id]);
    await activityRepository.log({
      workspaceId: ctx.workspaceId, actorId: ctx.userId, entityType: "project", entityId: id, projectId: id,
      action: "project.deleted", data: { name: current.dto.name },
    });
    await emit("project.deleted", { project: current.dto, actorId: ctx.userId });
  },
};

/** Acesso a projetos para outros módulos (colunas, tempo): mesma regra de tenant e permissão. */
export const projectAccess = {
  get: (ctx: ProjectContext, id: string) => findOrFail(ctx, id).then((r) => r.dto),
  async assertCanManageById(ctx: ProjectContext, id: string) {
    assertCanManage(ctx, (await findOrFail(ctx, id)).row);
  },
};
