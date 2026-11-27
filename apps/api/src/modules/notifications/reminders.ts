import { DEFAULT_DUE_TIME, REMINDER_OFFSETS, type Task } from "@andamo/shared";
import { db } from "../../db";
import { cancelPending, enqueue } from "../../jobs/queue";
import { registerJob, registerSchedule } from "../../jobs/worker";
import { queueEmail } from "../email/email.service";
import { emailTemplates } from "../email/templates";
import { notificationService } from "./notification.service";

export const taskLink = (t: Pick<Task, "workspaceId" | "projectId" | "id">) => `/app/w/${t.workspaceId}/projetos/${t.projectId}?tarefa=${t.id}`;

function offsetLabel(minutes: number): string {
  return REMINDER_OFFSETS.find((o) => o.minutes === minutes)?.label.toLowerCase() ?? `${minutes} min antes`;
}

/**
 * (Re)agenda os lembretes de uma tarefa para cada responsável, conforme as antecedências
 * escolhidas por cada um. Os lembretes ficam na fila durável (sobrevivem a reinícios);
 * no disparo, conferimos se o prazo ainda é o mesmo e se a tarefa segue aberta.
 */
export async function scheduleReminders(task: Task): Promise<void> {
  await cancelPending(`reminder:${task.id}:`);
  if (!task.dueDate || task.status === "done" || task.deletedAt || task.archivedAt) return;
  const recipients = task.assigneeIds.length ? task.assigneeIds : task.createdBy ? [task.createdBy] : [];
  if (!recipients.length) return;

  const prefs = await notificationService.loadPrefs(recipients);
  const dueKey = `${task.dueDate}T${task.dueTime ?? DEFAULT_DUE_TIME}`;
  for (const userId of recipients) {
    const p = prefs.get(userId);
    if (!p) continue;
    // Converte data+hora local do usuário para um instante UTC no próprio PostgreSQL.
    const { rows } = await db.query<{ offset: number; run_at: Date }>(
      `SELECT o AS offset, ((($1::date + $2::time) AT TIME ZONE $3) - make_interval(mins => o)) AS run_at
       FROM unnest($4::int[]) AS o`,
      [task.dueDate, task.dueTime ?? DEFAULT_DUE_TIME, p.timezone, p.reminder_offsets],
    );
    for (const { offset, run_at } of rows) {
      if (new Date(run_at) <= new Date()) continue;
      await enqueue(
        "task.reminder",
        { taskId: task.id, workspaceId: task.workspaceId, userId, offset, dueKey },
        { runAt: new Date(run_at), dedupeKey: `reminder:${task.id}:${userId}:${offset}:${dueKey}` },
      );
    }
  }
}

registerJob("task.reminder", async (payload) => {
  const p = payload as { taskId: string; workspaceId: string; userId: string; offset: number; dueKey: string };
  const { rows } = await db.query<{ title: string; project_id: string; due: string; status: string }>(
    `SELECT title, project_id, status, due_date::text || 'T' || COALESCE(to_char(due_time, 'HH24:MI'), $3) AS due
     FROM tasks WHERE id = $1 AND workspace_id = $2 AND deleted_at IS NULL AND archived_at IS NULL`,
    [p.taskId, p.workspaceId, DEFAULT_DUE_TIME],
  );
  const t = rows[0];
  // Prazo mudou, tarefa concluída ou excluída: lembrete obsoleto.
  if (!t || t.status === "done" || t.due !== p.dueKey) return;
  const overdue = p.offset < 0;
  await notificationService.notify({
    userIds: [p.userId],
    workspaceId: p.workspaceId,
    type: overdue ? "task.overdue" : "task.reminder",
    category: "reminders",
    title: overdue ? `Ainda pendente: ${t.title}` : p.offset === 0 ? `Vence agora: ${t.title}` : `Lembrete: ${t.title}`,
    body: overdue ? `Lembrete ${offsetLabel(p.offset)}.` : p.offset === 0 ? "O prazo desta tarefa é agora." : `Prazo ${offsetLabel(p.offset)}.`,
    link: taskLink({ workspaceId: p.workspaceId, projectId: t.project_id, id: p.taskId }),
    entityType: "task",
    entityId: p.taskId,
    projectId: t.project_id,
    dedupeKey: `reminder:${p.taskId}:${p.offset}:${p.dueKey}`,
  });
});

/** Varredura horária: tarefas que passaram do prazo (uma notificação por tarefa e prazo). */
registerJob("tasks.overdue_scan", async () => {
  const { rows } = await db.query<{ id: string; workspace_id: string; project_id: string; title: string; due_date: string; user_id: string }>(
    `SELECT t.id, t.workspace_id, t.project_id, t.title, t.due_date::text AS due_date, a.user_id
     FROM tasks t JOIN task_assignees a ON a.task_id = t.id JOIN users u ON u.id = a.user_id
     WHERE t.status <> 'done' AND t.deleted_at IS NULL AND t.archived_at IS NULL AND t.due_date IS NOT NULL
       AND t.due_date < (now() AT TIME ZONE u.timezone)::date
       AND t.due_date >= (now() AT TIME ZONE u.timezone)::date - 30
     LIMIT 2000`,
  );
  for (const r of rows) {
    await notificationService.notify({
      userIds: [r.user_id],
      workspaceId: r.workspace_id,
      type: "task.overdue",
      category: "reminders",
      title: `Tarefa atrasada: ${r.title}`,
      body: "O prazo desta tarefa já passou.",
      link: taskLink({ workspaceId: r.workspace_id, projectId: r.project_id, id: r.id }),
      entityType: "task",
      entityId: r.id,
      projectId: r.project_id,
      dedupeKey: `overdue:${r.id}:${r.due_date}`,
    });
  }
});

/** Automações com gatilho "tarefa atrasada" (inclusive tarefas sem responsável). Uma vez por tarefa e prazo. */
registerJob("tasks.overdue_automations", async () => {
  const { rows } = await db.query<{ id: string; workspace_id: string; project_id: string; due_date: string }>(
    `SELECT DISTINCT t.id, t.workspace_id, t.project_id, t.due_date::text AS due_date
     FROM tasks t JOIN automations a ON a.workspace_id = t.workspace_id AND a.trigger = 'task.overdue' AND a.enabled
     WHERE t.status <> 'done' AND t.deleted_at IS NULL AND t.archived_at IS NULL AND t.due_date IS NOT NULL
       AND t.due_date < current_date AND t.due_date >= current_date - 30
     LIMIT 2000`,
  );
  const { enqueueEvaluation } = await import("../automations/automation.engine");
  for (const r of rows) {
    await enqueueEvaluation({
      workspaceId: r.workspace_id, trigger: "task.overdue", projectId: r.project_id, taskId: r.id,
      eventKey: `overdue:${r.id}:${r.due_date}`, chain: { depth: 0, ids: [] },
    });
  }
});

/** Resumos por e-mail (diário às 8h; semanal às segundas, 8h — no fuso de cada usuário). */
registerJob("notifications.digest", async () => {
  const { rows } = await db.query<{ id: string; name: string; email: string; digest: "daily" | "weekly"; local_date: string }>(
    `SELECT u.id, u.name, u.email, p.email_digest AS digest, (now() AT TIME ZONE u.timezone)::date::text AS local_date
     FROM notification_preferences p JOIN users u ON u.id = p.user_id
     WHERE p.email AND p.email_digest IN ('daily', 'weekly') AND u.deleted_at IS NULL
       AND extract(hour FROM now() AT TIME ZONE u.timezone) = 8
       AND (p.email_digest = 'daily' OR extract(isodow FROM now() AT TIME ZONE u.timezone) = 1)`,
  );
  for (const u of rows) {
    const { rows: items } = await db.query<{ title: string; body: string | null }>(
      `SELECT title, body FROM notifications WHERE user_id = $1 AND read_at IS NULL
         AND created_at > now() - make_interval(days => $2) ORDER BY created_at DESC LIMIT 30`,
      [u.id, u.digest === "daily" ? 1 : 7],
    );
    if (!items.length) continue;
    await queueEmail(u.email, emailTemplates.digest(u.digest, u.name.split(" ")[0], items), {
      userId: u.id,
      dedupeKey: `digest:${u.digest}:${u.id}:${u.local_date}`,
    });
  }
});

/** Limpeza: jobs antigos e logs de entrega (mantém o banco enxuto). */
registerJob("maintenance.cleanup", async () => {
  await db.query(`DELETE FROM jobs WHERE status IN ('done', 'cancelled') AND finished_at < now() - interval '7 days'`);
  await db.query(`DELETE FROM delivery_logs WHERE created_at < now() - interval '90 days'`);
  await db.query(`DELETE FROM auth_tokens WHERE expires_at < now() - interval '7 days'`);
  await db.query(`DELETE FROM sessions WHERE (revoked_at IS NOT NULL AND revoked_at < now() - interval '30 days') OR expires_at < now() - interval '30 days'`);
});

registerSchedule("tasks.overdue_scan", 60);
registerSchedule("tasks.overdue_automations", 60);
registerSchedule("notifications.digest", 60);
registerSchedule("maintenance.cleanup", 24 * 60);
