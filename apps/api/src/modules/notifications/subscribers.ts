import { PRIORITY_LABELS, ROLE_LABELS, STATUS_LABELS, type Task } from "@andamo/shared";
import { db } from "../../db";
import { on } from "../../events/bus";
import { publishToUser, publishToWorkspace } from "../../realtime/hub";
import { notificationService as n } from "./notification.service";
import { scheduleReminders, taskLink } from "./reminders";

/** Assinantes dos eventos de domínio: notificações, tempo real e lembretes. */

async function actorName(id: string): Promise<string> {
  const { rows } = await db.query<{ name: string }>(`SELECT name FROM users WHERE id = $1`, [id]);
  return rows[0]?.name.split(" ")[0] ?? "Alguém";
}

async function followers(taskId: string): Promise<string[]> {
  const { rows } = await db.query<{ user_id: string }>(`SELECT user_id FROM task_followers WHERE task_id = $1`, [taskId]);
  return rows.map((r) => r.user_id);
}

/** Interessados numa tarefa: responsáveis + seguidores + criador. */
async function audience(task: Task): Promise<string[]> {
  return [...new Set([...task.assigneeIds, ...(await followers(task.id)), ...(task.createdBy ? [task.createdBy] : [])])];
}

const base = (task: Task) => ({
  workspaceId: task.workspaceId,
  link: taskLink(task),
  entityType: "task",
  entityId: task.id,
  projectId: task.projectId,
});

function realtimeTask(task: Task, actorId: string, kind: string) {
  publishToWorkspace(task.workspaceId, { type: "task.changed", kind, taskId: task.id, projectId: task.projectId, actorId });
}

on("task.created", async ({ task, actorId }) => {
  realtimeTask(task, actorId, "created");
  await scheduleReminders(task);
  if (!task.assigneeIds.length) return;
  const who = await actorName(actorId);
  await n.notify({
    ...base(task),
    userIds: task.assigneeIds,
    actorId,
    type: "task.assigned",
    category: "tasks",
    title: `${who} atribuiu uma tarefa a você`,
    body: task.title,
    dedupeKey: `assigned:${task.id}:${task.createdAt}`,
  });
});

on("task.updated", async ({ before, after, actorId }) => {
  realtimeTask(after, actorId, "updated");
  const dueChanged = before.dueDate !== after.dueDate || before.dueTime !== after.dueTime;
  const assigneesChanged = before.assigneeIds.join() !== after.assigneeIds.join();
  if (dueChanged || assigneesChanged || before.status !== after.status || before.archivedAt !== after.archivedAt) {
    await scheduleReminders(after);
  }

  const who = await actorName(actorId);
  const key = `${after.id}:${after.updatedAt}`;

  const added = after.assigneeIds.filter((id) => !before.assigneeIds.includes(id));
  if (added.length) {
    await n.notify({ ...base(after), userIds: added, actorId, type: "task.assigned", category: "tasks", title: `${who} atribuiu uma tarefa a você`, body: after.title, dedupeKey: `assigned:${key}` });
  }

  // Uma notificação por alteração, com o tipo mais relevante.
  let type: string | null = null;
  let title = "";
  if (before.status !== after.status) {
    if (after.status === "done") [type, title] = ["task.completed", `${who} concluiu “${after.title}”`];
    else if (before.status === "done") [type, title] = ["task.reopened", `${who} reabriu “${after.title}”`];
    else [type, title] = ["task.status_changed", `${who} moveu “${after.title}” para ${STATUS_LABELS[after.status]}`];
  } else if (before.priority !== after.priority) {
    [type, title] = ["task.priority_changed", `${who} mudou a prioridade de “${after.title}” para ${PRIORITY_LABELS[after.priority]}`];
  } else if (dueChanged) {
    [type, title] = ["task.due_changed", after.dueDate ? `${who} alterou o prazo de “${after.title}”` : `${who} removeu o prazo de “${after.title}”`];
  } else if (before.title !== after.title || before.description !== after.description) {
    [type, title] = ["task.updated", `${who} editou “${after.title}”`];
  }
  if (type) {
    const recipients = (await audience(after)).filter((id) => !added.includes(id));
    await n.notify({ ...base(after), userIds: recipients, actorId, type, category: "tasks", title, dedupeKey: `${type}:${key}` });
  }

  // Concluir pode desbloquear tarefas que dependiam desta.
  if (after.status === "done" && before.status !== "done") {
    const { rows } = await db.query<{ id: string; title: string; project_id: string; user_id: string }>(
      `SELECT t.id, t.title, t.project_id, a.user_id FROM task_dependencies d
       JOIN tasks t ON t.id = d.task_id AND t.deleted_at IS NULL AND t.status <> 'done'
       JOIN task_assignees a ON a.task_id = t.id
       WHERE d.depends_on_id = $1 AND NOT EXISTS (
         SELECT 1 FROM task_dependencies d2 JOIN tasks o ON o.id = d2.depends_on_id
         WHERE d2.task_id = t.id AND o.status <> 'done' AND o.deleted_at IS NULL)`,
      [after.id],
    );
    for (const r of rows) {
      await n.notify({
        workspaceId: after.workspaceId, userIds: [r.user_id], actorId, type: "dependency.unblocked", category: "tasks",
        title: `“${r.title}” foi desbloqueada`, body: `A dependência “${after.title}” foi concluída.`,
        link: taskLink({ workspaceId: after.workspaceId, projectId: r.project_id, id: r.id }),
        entityType: "task", entityId: r.id, projectId: r.project_id, dedupeKey: `unblocked:${r.id}:${after.id}:${after.updatedAt}`,
      });
    }
  }
});

on("task.deleted", async ({ task, actorId }) => {
  realtimeTask(task, actorId, "deleted");
  await scheduleReminders({ ...task, deletedAt: task.deletedAt ?? new Date().toISOString() });
});

on("task.restored", async ({ task, actorId }) => {
  realtimeTask(task, actorId, "restored");
  await scheduleReminders(task);
});

on("comment.created", async ({ comment, task, actorId, mentionIds }) => {
  const who = await actorName(actorId);
  const excerpt = comment.body.replace(/@\[([^\]]+)\]\([0-9a-f-]{36}\)/gi, "@$1").slice(0, 160);
  if (mentionIds.length) {
    await n.notify({ ...base(task), userIds: mentionIds, actorId, type: "mention", category: "mentions", title: `${who} mencionou você em “${task.title}”`, body: excerpt, dedupeKey: `mention:${comment.id}` });
  }
  const others = (await audience(task)).filter((id) => !mentionIds.includes(id));
  await n.notify({ ...base(task), userIds: others, actorId, type: "comment.created", category: "comments", title: `${who} comentou em “${task.title}”`, body: excerpt, dedupeKey: `comment:${comment.id}` });
});

on("project.updated", async ({ before, after, actorId }) => {
  publishToWorkspace(after.workspaceId, { type: "project.changed", projectId: after.id, actorId });
  if (after.status === "completed" && before.status !== "completed") {
    const { rows } = await db.query<{ user_id: string }>(
      `SELECT DISTINCT a.user_id FROM task_assignees a JOIN tasks t ON t.id = a.task_id WHERE t.project_id = $1
       UNION SELECT owner_id FROM projects WHERE id = $1 AND owner_id IS NOT NULL`,
      [after.id],
    );
    await n.notify({
      workspaceId: after.workspaceId, userIds: rows.map((r) => r.user_id), actorId, type: "project.completed", category: "workspace",
      title: `Projeto concluído: ${after.name}`, body: "Parabéns ao time!", link: `/app/w/${after.workspaceId}/projetos/${after.id}`,
      entityType: "project", entityId: after.id, projectId: after.id, dedupeKey: `project.completed:${after.id}:${after.updatedAt}`,
    });
  }
});

on("project.created", ({ project, actorId }) => {
  publishToWorkspace(project.workspaceId, { type: "project.changed", projectId: project.id, actorId });
});

on("project.deleted", ({ project, actorId }) => {
  publishToWorkspace(project.workspaceId, { type: "project.changed", projectId: project.id, actorId });
});

on("member.invited", async ({ workspaceId, actorId, userId }) => {
  if (!userId) return;
  const [{ rows }, who] = await Promise.all([db.query<{ name: string }>(`SELECT name FROM workspaces WHERE id = $1`, [workspaceId]), actorName(actorId)]);
  await n.notify({
    workspaceId: null, userIds: [userId], actorId, type: "invitation.received", category: "workspace",
    title: `${who} convidou você para ${rows[0]?.name ?? "um workspace"}`, body: "Abra o link enviado por e-mail para aceitar.",
    link: null, dedupeKey: `invite:${workspaceId}:${userId}:${Date.now()}`,
  });
});

on("member.joined", async ({ workspaceId, userId }) => {
  publishToWorkspace(workspaceId, { type: "members.changed" });
  const { rows } = await db.query<{ user_id: string }>(
    `SELECT user_id FROM workspace_members WHERE workspace_id = $1 AND role IN ('owner', 'admin', 'manager')`,
    [workspaceId],
  );
  const who = await actorName(userId);
  await n.notify({
    workspaceId, userIds: rows.map((r) => r.user_id), actorId: userId, type: "member.joined", category: "workspace",
    title: `${who} entrou no workspace`, link: `/app/w/${workspaceId}/equipe`, entityType: "member", entityId: userId,
    dedupeKey: `joined:${workspaceId}:${userId}`,
  });
});

on("member.role_changed", async ({ workspaceId, userId, to, actorId }) => {
  publishToWorkspace(workspaceId, { type: "members.changed" });
  publishToUser(userId, { type: "workspaces.changed" });
  await n.notify({
    workspaceId, userIds: [userId], actorId, type: "permission.changed", category: "workspace",
    title: `Seu papel mudou para ${ROLE_LABELS[to]}`, link: `/app/w/${workspaceId}`, entityType: "member", entityId: userId,
    dedupeKey: `role:${workspaceId}:${userId}:${to}:${Date.now()}`,
  });
});

on("member.removed", ({ workspaceId, userId }) => {
  publishToWorkspace(workspaceId, { type: "members.changed" });
  publishToUser(userId, { type: "workspaces.changed" });
});
