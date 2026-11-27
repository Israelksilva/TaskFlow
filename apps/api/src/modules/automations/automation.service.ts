import {
  can,
  PLANS,
  type Automation,
  type AutomationAction,
  type AutomationConditions,
  type AutomationRun,
  type AutomationTrigger,
  type PlanId,
  type Role,
} from "@andamo/shared";
import { db, type Queryable } from "../../db";
import { toISO } from "../../shared/dates";
import { BadRequestError, ForbiddenError, NotFoundError, PlanLimitError } from "../../shared/errors";
import { activityRepository } from "../activity/activity.repository";
import { workspaceRepository } from "../workspaces/workspace.repository";

export interface AutomationContext {
  workspaceId: string;
  userId: string;
  role: Role;
  plan: PlanId;
}

export interface AutomationRow {
  id: string;
  workspace_id: string;
  project_id: string | null;
  name: string;
  enabled: boolean;
  trigger: AutomationTrigger;
  conditions: AutomationConditions | string;
  actions: AutomationAction[] | string;
  created_by: string | null;
  creator_name: string | null;
  creator_avatar: string | null;
  run_count: number;
  last_run_at: Date | string | null;
  last_error: string | null;
  created_at: Date | string;
}

const json = <T>(v: T | string): T => (typeof v === "string" ? (JSON.parse(v) as T) : v);

export const toAutomationDTO = (r: AutomationRow): Automation => ({
  id: r.id,
  workspaceId: r.workspace_id,
  projectId: r.project_id,
  name: r.name,
  enabled: r.enabled,
  trigger: r.trigger,
  conditions: json(r.conditions),
  actions: json(r.actions),
  createdBy: r.created_by && r.creator_name ? { id: r.created_by, name: r.creator_name, avatarUrl: r.creator_avatar } : null,
  runCount: r.run_count,
  lastRunAt: r.last_run_at ? toISO(r.last_run_at) : null,
  lastError: r.last_error,
  createdAt: toISO(r.created_at),
});

export const AUTOMATION_SELECT = `SELECT a.id, a.workspace_id, a.project_id, a.name, a.enabled, a.trigger, a.conditions, a.actions,
    a.created_by, u.name AS creator_name, u.avatar_url AS creator_avatar, a.run_count, a.last_run_at, a.last_error, a.created_at
  FROM automations a LEFT JOIN users u ON u.id = a.created_by`;

function assertManage(ctx: AutomationContext) {
  if (!can(ctx.role, "automations.manage")) throw new ForbiddenError("Apenas gestores e administradores gerenciam automações");
}

async function findOrFail(ctx: AutomationContext, id: string, tx: Queryable = db): Promise<AutomationRow> {
  const { rows } = await tx.query<AutomationRow>(`${AUTOMATION_SELECT} WHERE a.id = $1 AND a.workspace_id = $2`, [id, ctx.workspaceId]);
  if (!rows[0]) throw new NotFoundError("Automação");
  return rows[0];
}

/** Toda referência (projeto, pessoa, coluna, etiqueta) precisa pertencer a este workspace. */
async function validateRefs(
  ctx: AutomationContext,
  data: { projectId?: string | null; conditions?: AutomationConditions; actions?: AutomationAction[] },
  current?: AutomationRow,
) {
  const projectId = data.projectId !== undefined ? data.projectId : (current?.project_id ?? null);
  if (projectId) {
    const { rows } = await db.query(`SELECT 1 FROM projects WHERE id = $1 AND workspace_id = $2 AND deleted_at IS NULL`, [projectId, ctx.workspaceId]);
    if (!rows[0]) throw new BadRequestError("Projeto inválido");
  }
  const userIds = [
    data.conditions?.assigneeId,
    ...(data.actions ?? []).map((a) => (a.type === "assign" || (a.type === "notify" && a.target === "user") ? a.userId : undefined)),
  ].filter((v): v is string => Boolean(v));
  if (userIds.length) {
    const members = await workspaceRepository.filterMembers(ctx.workspaceId, userIds);
    if (members.length !== new Set(userIds).size) throw new BadRequestError("Pessoa informada não é membro do workspace");
  }
  const columnIds = [data.conditions?.toColumnId, ...(data.actions ?? []).map((a) => (a.type === "move_to_column" ? a.columnId : undefined))].filter(
    (v): v is string => Boolean(v),
  );
  for (const columnId of columnIds) {
    const { rows } = await db.query(`SELECT 1 FROM project_columns WHERE id = $1 AND project_id = $2`, [columnId, projectId]);
    if (!rows[0]) throw new BadRequestError("A coluna precisa ser do projeto escolhido");
  }
  const labelIds = [data.conditions?.labelId, ...(data.actions ?? []).map((a) => (a.type === "add_label" ? a.labelId : undefined))].filter(
    (v): v is string => Boolean(v),
  );
  for (const labelId of labelIds) {
    const { rows } = await db.query(`SELECT 1 FROM labels WHERE id = $1 AND workspace_id = $2`, [labelId, ctx.workspaceId]);
    if (!rows[0]) throw new BadRequestError("Etiqueta inválida");
  }
}

async function assertWithinPlan(ctx: AutomationContext) {
  const plan = PLANS[ctx.plan];
  if (!plan.features.automations) throw new PlanLimitError(`Automações não estão incluídas no plano ${plan.name}`);
  if (plan.limits.automations === null) return;
  const { rows } = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM automations WHERE workspace_id = $1`, [ctx.workspaceId]);
  if (rows[0].n >= plan.limits.automations) {
    throw new PlanLimitError(`O plano ${plan.name} permite até ${plan.limits.automations} automações. Exclua uma ou faça upgrade.`);
  }
}

export const automationService = {
  async list(ctx: AutomationContext): Promise<Automation[]> {
    const { rows } = await db.query<AutomationRow>(`${AUTOMATION_SELECT} WHERE a.workspace_id = $1 ORDER BY a.created_at`, [ctx.workspaceId]);
    return rows.map(toAutomationDTO);
  },

  async create(
    ctx: AutomationContext,
    data: { name: string; projectId: string | null; trigger: AutomationTrigger; conditions: AutomationConditions; actions: AutomationAction[]; enabled: boolean },
  ): Promise<Automation> {
    assertManage(ctx);
    await assertWithinPlan(ctx);
    await validateRefs(ctx, data);
    const { rows } = await db.query<{ id: string }>(
      `INSERT INTO automations (workspace_id, project_id, name, enabled, trigger, conditions, actions, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [ctx.workspaceId, data.projectId, data.name, data.enabled, data.trigger, JSON.stringify(data.conditions), JSON.stringify(data.actions), ctx.userId],
    );
    await activityRepository.log({
      workspaceId: ctx.workspaceId, actorId: ctx.userId, entityType: "workspace", entityId: ctx.workspaceId,
      action: "automation.created", data: { name: data.name },
    });
    return toAutomationDTO(await findOrFail(ctx, rows[0].id));
  },

  async update(
    ctx: AutomationContext,
    id: string,
    data: Partial<{ name: string; projectId: string | null; trigger: AutomationTrigger; conditions: AutomationConditions; actions: AutomationAction[]; enabled: boolean }>,
  ): Promise<Automation> {
    assertManage(ctx);
    const current = await findOrFail(ctx, id);
    const merged = {
      projectId: data.projectId !== undefined ? data.projectId : current.project_id,
      conditions: data.conditions ?? json(current.conditions),
      actions: data.actions ?? json(current.actions),
    };
    await validateRefs(ctx, merged);
    await db.query(
      `UPDATE automations SET name = COALESCE($3, name), project_id = $4, enabled = COALESCE($5, enabled),
         trigger = COALESCE($6, trigger), conditions = $7, actions = $8, updated_at = now(),
         last_error = CASE WHEN $5 THEN NULL ELSE last_error END
       WHERE id = $1 AND workspace_id = $2`,
      [id, ctx.workspaceId, data.name ?? null, merged.projectId, data.enabled ?? null, data.trigger ?? null, JSON.stringify(merged.conditions), JSON.stringify(merged.actions)],
    );
    return toAutomationDTO(await findOrFail(ctx, id));
  },

  async remove(ctx: AutomationContext, id: string): Promise<void> {
    assertManage(ctx);
    const current = await findOrFail(ctx, id);
    await db.query(`DELETE FROM automations WHERE id = $1`, [id]);
    await activityRepository.log({
      workspaceId: ctx.workspaceId, actorId: ctx.userId, entityType: "workspace", entityId: ctx.workspaceId,
      action: "automation.deleted", data: { name: current.name },
    });
  },

  async runs(ctx: AutomationContext, automationId?: string): Promise<AutomationRun[]> {
    const params: unknown[] = [ctx.workspaceId];
    let filter = "";
    if (automationId) {
      params.push(automationId);
      filter = " AND r.automation_id = $2";
    }
    const { rows } = await db.query<{
      id: string; automation_id: string; name: string; task_id: string | null; title: string | null;
      status: AutomationRun["status"]; detail: string | null; depth: number; created_at: Date | string;
    }>(
      `SELECT r.id::text AS id, r.automation_id, a.name, r.task_id, t.title, r.status, r.detail, r.depth, r.created_at
       FROM automation_runs r JOIN automations a ON a.id = r.automation_id LEFT JOIN tasks t ON t.id = r.task_id
       WHERE r.workspace_id = $1${filter} ORDER BY r.created_at DESC, r.id DESC LIMIT 100`,
      params,
    );
    return rows.map((r) => ({
      id: r.id,
      automationId: r.automation_id,
      automationName: r.name,
      taskId: r.task_id,
      taskTitle: r.title,
      status: r.status,
      detail: r.detail,
      depth: r.depth,
      createdAt: toISO(r.created_at),
    }));
  },
};
