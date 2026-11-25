import { RECURRENCES, taskPrioritySchema, taskStatusSchema, type Recurrence, type Task } from "@andamo/shared";
import { toISO } from "../../shared/dates";
import type { TaskRow } from "./task.repository";

const isRecurrence = (v: string | null): v is Recurrence => v !== null && (RECURRENCES as readonly string[]).includes(v);

/** Progresso: concluída = 100; senão, média de subtarefas + itens de checklist concluídos. */
export function computeProgress(row: Pick<TaskRow, "status" | "subtask_count" | "subtask_done" | "checklist_count" | "checklist_done">) {
  if (row.status === "done") return 100;
  const total = row.subtask_count + row.checklist_count;
  return total === 0 ? 0 : Math.round(((row.subtask_done + row.checklist_done) / total) * 100);
}

export function toTaskDTO(row: TaskRow): Task {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    projectId: row.project_id,
    parentId: row.parent_id,
    title: row.title,
    description: row.description,
    priority: taskPrioritySchema.catch("media").parse(row.priority),
    status: taskStatusSchema.catch("todo").parse(row.status),
    position: row.position,
    startDate: row.start_date,
    dueDate: row.due_date,
    dueTime: row.due_time,
    estimateMinutes: row.estimate_minutes,
    recurrence: isRecurrence(row.recurrence) ? row.recurrence : null,
    assigneeIds: row.assignee_ids ?? [],
    labelIds: row.label_ids ?? [],
    createdBy: row.user_id,
    subtaskCount: row.subtask_count,
    subtaskDoneCount: row.subtask_done,
    checklistCount: row.checklist_count,
    checklistDoneCount: row.checklist_done,
    commentCount: row.comment_count,
    progress: computeProgress(row),
    completedAt: row.completed_at ? toISO(row.completed_at) : null,
    archivedAt: row.archived_at ? toISO(row.archived_at) : null,
    deletedAt: row.deleted_at ? toISO(row.deleted_at) : null,
    createdAt: toISO(row.created_at),
    updatedAt: toISO(row.updated_at),
  };
}
