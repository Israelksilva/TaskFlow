import { taskPrioritySchema, taskStatusSchema, type Task } from "@andamo/shared";
import { toISO } from "../../shared/dates";
import type { TaskRow } from "./task.repository";

export function toTaskDTO(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    priority: taskPrioritySchema.catch("media").parse(row.priority),
    status: taskStatusSchema.catch("todo").parse(row.status),
    position: row.position,
    dueDate: row.due_date,
    completedAt: row.completed_at ? toISO(row.completed_at) : null,
    createdAt: toISO(row.created_at),
    updatedAt: toISO(row.updated_at),
  };
}
