import { addDays, toISODate, TRIGGER_LABELS, type AutomationAction, type AutomationConditions, type AutomationTrigger, type Role, type Task } from "@andamo/shared";
import { db } from "../../db";
import { on, type AutomationChain } from "../../events/bus";
import { enqueue } from "../../jobs/queue";
import { registerJob } from "../../jobs/worker";
import { logger } from "../../lib/logger";
import { notificationService } from "../notifications/notification.service";
import { taskLink } from "../notifications/reminders";
import { taskService, type TaskContext } from "../tasks/task.service";
import { toAutomationDTO, AUTOMATION_SELECT, type AutomationRow } from "./automation.service";

/** Profundidade máxima de automações disparando automações. */
export const MAX_CHAIN_DEPTH = 3;
/** Execuções por automação por hora (proteção contra rajadas e loops entre tarefas diferentes). */
export const MAX_RUNS_PER_HOUR = 100;

interface EvalPayload {
  workspaceId: string;
  trigger: AutomationTrigger;
  projectId: string;
  taskId: string | null;
  toStatus?: string;
  toColumnId?: string | null;
  eventKey: string;
  chain: AutomationChain;
}

const ROOT: AutomationChain = { depth: 0, ids: [] };

/** Só enfileira se houver automação ativa para o gatilho (evita jobs inúteis a cada edição). */
export async function enqueueEvaluation(payload: EvalPayload): Promise<void> {
  const { rows } = await db.query(
    `SELECT 1 FROM automations WHERE workspace_id = $1 AND trigger = $2 AND enabled AND (project_id IS NULL OR project_id = $3) LIMIT 1`,
    [payload.workspaceId, payload.trigger, payload.projectId],
  );
  if (!rows[0]) return;
  await enqueue("automation.evaluate", { ...payload }, { dedupeKey: `automation:${payload.trigger}:${payload.eventKey}`.slice(0, 200), maxAttempts: 3 });
}

function matches(conditions: AutomationConditions, task: Task | null, p: EvalPayload): boolean {
  if (conditions.toStatus && conditions.toStatus !== p.toStatus) return false;
  if (conditions.toColumnId && conditions.toColumnId !== p.toColumnId) return false;
  if (!task) return !conditions.priorities?.length && !conditions.labelId && !conditions.assigneeId;
  if (conditions.priorities?.length && !conditions.priorities.includes(task.priority)) return false;
  if (conditions.labelId && !task.labelIds.includes(conditions.labelId)) return false;
  if (conditions.assigneeId && !task.assigneeIds.includes(conditions.assigneeId)) return false;
  return true;
}

async function recipients(action: Extract<AutomationAction, { type: "notify" }>, workspaceId: string, projectId: string, task: Task | null): Promise<string[]> {
  switch (action.target) {
    case "assignees":
      return task?.assigneeIds ?? [];
    case "creator":
      return task?.createdBy ? [task.createdBy] : [];
    case "followers": {
      if (!task) return [];
      const { rows } = await db.query<{ user_id: string }>(`SELECT user_id FROM task_followers WHERE task_id = $1`, [task.id]);
      return rows.map((r) => r.user_id);
    }
    case "managers": {
      const { rows } = await db.query<{ user_id: string }>(
        `SELECT user_id FROM workspace_members WHERE workspace_id = $1 AND role IN ('owner', 'admin', 'manager')`,
        [workspaceId],
      );
      return rows.map((r) => r.user_id);
    }
    case "project_members": {
      const { rows } = await db.query<{ user_id: string }>(
        `SELECT DISTINCT a.user_id FROM task_assignees a JOIN tasks t ON t.id = a.task_id WHERE t.project_id = $1 AND t.deleted_at IS NULL
         UNION SELECT owner_id FROM projects WHERE id = $1 AND owner_id IS NOT NULL`,
        [projectId],
      );
      return rows.map((r) => r.user_id);
    }
    case "user":
      return action.userId ? [action.userId] : [];
  }
}

async function allSubtasksDone(parentId: string): Promise<boolean> {
  const { rows } = await db.query<{ total: number; open: number }>(
    `SELECT count(*)::int AS total, count(*) FILTER (WHERE status <> 'done')::int AS open FROM tasks WHERE parent_id = $1 AND deleted_at IS NULL`,
    [parentId],
  );
  return rows[0].total > 0 && rows[0].open === 0;
}

async function execute(automation: AutomationRow, p: EvalPayload, task: Task | null, ctx: TaskContext): Promise<string> {
  const done: string[] = [];
  const projectName = async () => (await db.query<{ name: string }>(`SELECT name FROM projects WHERE id = $1`, [p.projectId])).rows[0]?.name ?? "Projeto";
  for (const [i, action] of (typeof automation.actions === "string" ? (JSON.parse(automation.actions) as AutomationAction[]) : automation.actions).entries()) {
    if (action.type === "notify") {
      const userIds = await recipients(action, p.workspaceId, p.projectId, task);
      const subject = task ? `“${task.title}”` : `o projeto “${await projectName()}”`;
      const count = await notificationService.notify({
        userIds,
        workspaceId: p.workspaceId,
        type: "automation",
        category: p.trigger === "task.overdue" ? "reminders" : "tasks",
        title: action.message?.trim() ? `${action.message.trim()} — ${task?.title ?? (await projectName())}` : `${automation.name}: ${subject}`,
        body: TRIGGER_LABELS[p.trigger],
        link: task ? taskLink(task) : `/app/w/${p.workspaceId}/projetos/${p.projectId}`,
        entityType: task ? "task" : "project",
        entityId: task?.id ?? p.projectId,
        projectId: p.projectId,
        actorId: null,
        dedupeKey: `automation:${automation.id}:${p.eventKey}:${i}`.slice(0, 200),
      });
      done.push(`notificou ${count} pessoa(s)`);
      continue;
    }
    if (!task) continue;
    switch (action.type) {
      case "assign":
        if (!task.assigneeIds.includes(action.userId)) await taskService.update(ctx, task.id, { assigneeIds: [...task.assigneeIds, action.userId] });
        done.push("atribuiu");
        break;
      case "set_priority":
        if (task.priority !== action.priority) await taskService.update(ctx, task.id, { priority: action.priority });
        done.push(`prioridade ${action.priority}`);
        break;
      case "move_to_column":
        if (task.columnId !== action.columnId && !task.parentId) await taskService.update(ctx, task.id, { columnId: action.columnId });
        done.push("moveu de coluna");
        break;
      case "add_label":
        if (!task.labelIds.includes(action.labelId)) await taskService.update(ctx, task.id, { labelIds: [...task.labelIds, action.labelId] });
        done.push("adicionou etiqueta");
        break;
      case "set_due_in_days":
        await taskService.update(ctx, task.id, { dueDate: addDays(toISODate(), action.days) });
        done.push(`prazo em ${action.days} dia(s)`);
        break;
      case "complete_parent": {
        // subtasks.completed → a própria tarefa é a principal; task.completed de subtarefa → sobe para a principal.
        const parentId = p.trigger === "subtasks.completed" ? task.id : task.parentId;
        if (parentId && (await allSubtasksDone(parentId))) {
          const parent = await taskService.loadOrFail(ctx, parentId);
          if (parent.status !== "done") await taskService.update(ctx, parentId, { status: "done" });
          done.push("concluiu a tarefa principal");
        }
        break;
      }
    }
    // Recarrega após cada ação para a próxima usar o estado atual.
    task = await taskService.loadOrFail(ctx, task.id, undefined, true);
  }
  return done.join(", ") || "nenhuma ação aplicável";
}

registerJob("automation.evaluate", async (payload) => {
  const p = payload as unknown as EvalPayload;
  const { rows } = await db.query<AutomationRow>(
    `${AUTOMATION_SELECT} WHERE a.workspace_id = $1 AND a.trigger = $2 AND a.enabled AND (a.project_id IS NULL OR a.project_id = $3) ORDER BY a.created_at`,
    [p.workspaceId, p.trigger, p.projectId],
  );
  for (const automation of rows) {
    const dto = toAutomationDTO(automation);
    const record = async (status: "success" | "skipped" | "failed", detail: string) => {
      const res = await db.query(
        `INSERT INTO automation_runs (automation_id, workspace_id, task_id, project_id, status, detail, depth, event_key)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (automation_id, event_key) DO NOTHING RETURNING id`,
        [automation.id, p.workspaceId, p.taskId, p.projectId, status, detail.slice(0, 500), p.chain.depth, p.eventKey.slice(0, 200)],
      );
      return res.rows.length > 0;
    };

    // Prevenção de loops: a mesma automação não participa duas vezes da mesma cadeia.
    if (p.chain.ids.includes(automation.id)) {
      await record("skipped", "Ignorada para evitar loop: esta automação já atuou nesta sequência");
      continue;
    }
    if (p.chain.depth >= MAX_CHAIN_DEPTH) {
      await record("skipped", `Limite de ${MAX_CHAIN_DEPTH} automações encadeadas atingido`);
      continue;
    }
    const { rows: recent } = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM automation_runs WHERE automation_id = $1 AND created_at > now() - interval '1 hour'`,
      [automation.id],
    );
    if (recent[0].n >= MAX_RUNS_PER_HOUR) {
      await record("skipped", `Limite de ${MAX_RUNS_PER_HOUR} execuções por hora atingido`);
      continue;
    }

    const { rows: member } = await db.query<{ role: Role }>(
      `SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
      [p.workspaceId, automation.created_by],
    );
    const ctx: TaskContext | null = member[0]
      ? { workspaceId: p.workspaceId, userId: automation.created_by!, role: member[0].role, automation: { depth: p.chain.depth + 1, ids: [...p.chain.ids, automation.id] } }
      : null;
    let task: Task | null = null;
    if (p.taskId && ctx) {
      try {
        task = await taskService.loadOrFail(ctx, p.taskId);
      } catch {
        continue; // tarefa excluída depois do evento: nada a fazer
      }
    }
    if (!matches(dto.conditions, task, p)) continue;

    // Reserva a execução (idempotência) antes de agir.
    if (!(await record("success", "em execução"))) continue;
    try {
      if (!ctx) throw new Error("Quem criou a automação não é mais membro do workspace");
      const detail = await execute(automation, p, task, ctx);
      await db.query(`UPDATE automation_runs SET detail = $3 WHERE automation_id = $1 AND event_key = $2`, [automation.id, p.eventKey.slice(0, 200), detail]);
      await db.query(`UPDATE automations SET run_count = run_count + 1, last_run_at = now(), last_error = NULL WHERE id = $1`, [automation.id]);
    } catch (error) {
      const message = (error instanceof Error ? error.message : String(error)).slice(0, 500);
      logger.warn({ err: error, automationId: automation.id }, "Automação falhou");
      await db.query(`UPDATE automation_runs SET status = 'failed', detail = $3 WHERE automation_id = $1 AND event_key = $2`, [automation.id, p.eventKey.slice(0, 200), message]);
      await db.query(`UPDATE automations SET last_error = $2, last_run_at = now() WHERE id = $1`, [automation.id, message]);
      if (automation.created_by) {
        await notificationService.notify({
          userIds: [automation.created_by],
          workspaceId: p.workspaceId,
          type: "automation.failed",
          category: "system",
          title: `A automação “${automation.name}” falhou`,
          body: message,
          link: `/app/w/${p.workspaceId}/automacoes`,
          dedupeKey: `automation.failed:${automation.id}:${p.eventKey}`.slice(0, 200),
        });
      }
    }
  }
});

// ---------------------------------------------------------------- eventos → avaliação
on("task.created", async ({ task, automation }) => {
  await enqueueEvaluation({
    workspaceId: task.workspaceId, trigger: "task.created", projectId: task.projectId, taskId: task.id,
    eventKey: `created:${task.id}`, chain: automation ?? ROOT,
  });
});

on("task.updated", async ({ before, after, automation }) => {
  const chain = automation ?? ROOT;
  const base = { workspaceId: after.workspaceId, projectId: after.projectId, taskId: after.id, chain };
  const version = after.updatedAt;
  if (before.status !== after.status) {
    await enqueueEvaluation({ ...base, trigger: "task.status_changed", toStatus: after.status, eventKey: `status:${after.id}:${version}` });
    if (after.status === "done") {
      await enqueueEvaluation({ ...base, trigger: "task.completed", toStatus: "done", eventKey: `completed:${after.id}:${version}` });
      if (after.parentId && (await allSubtasksDone(after.parentId))) {
        await enqueueEvaluation({ ...base, taskId: after.parentId, trigger: "subtasks.completed", eventKey: `subtasks:${after.parentId}:${version}` });
      }
    }
  }
  if (before.columnId !== after.columnId && after.columnId) {
    await enqueueEvaluation({ ...base, trigger: "task.moved", toColumnId: after.columnId, toStatus: after.status, eventKey: `moved:${after.id}:${version}` });
  }
});

on("project.updated", async ({ before, after }) => {
  if (after.status === "completed" && before.status !== "completed") {
    await enqueueEvaluation({
      workspaceId: after.workspaceId, trigger: "project.completed", projectId: after.id, taskId: null,
      eventKey: `project:${after.id}:${after.updatedAt}`, chain: ROOT,
    });
  }
});
