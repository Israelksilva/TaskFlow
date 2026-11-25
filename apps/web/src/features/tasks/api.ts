import type {
  Activity,
  BulkTaskInput,
  ChecklistItem,
  Comment,
  CreateTaskInput,
  Page,
  Task,
  TaskDetail,
  TaskQueryInput,
  UpdateTaskInput,
} from "@andamo/shared";
import { apiRequest } from "@/lib/api-client";

const base = (ws: string) => `/v1/workspaces/${ws}/tarefas`;

export const tasksApi = {
  list: (ws: string, query: TaskQueryInput = {}, signal?: AbortSignal) =>
    apiRequest<{ tasks: Task[] }>(base(ws), { query: { ...query }, signal }).then((r) => r.tasks),

  get: (ws: string, id: string) => apiRequest<{ task: TaskDetail }>(`${base(ws)}/${id}`).then((r) => r.task),

  create: (ws: string, input: CreateTaskInput) =>
    apiRequest<{ task: Task }>(base(ws), { method: "POST", body: input }).then((r) => r.task),

  /** PATCH parcial: envie apenas os campos alterados. */
  update: (ws: string, id: string, changes: UpdateTaskInput) =>
    apiRequest<{ task: Task }>(`${base(ws)}/${id}`, { method: "PATCH", body: changes }).then((r) => r.task),

  remove: (ws: string, id: string) => apiRequest<void>(`${base(ws)}/${id}`, { method: "DELETE" }),
  restore: (ws: string, id: string) => apiRequest<{ task: Task }>(`${base(ws)}/${id}/restaurar`, { method: "POST" }).then((r) => r.task),
  destroy: (ws: string, id: string) => apiRequest<void>(`${base(ws)}/${id}/permanente`, { method: "DELETE" }),
  archive: (ws: string, id: string, archived: boolean) =>
    apiRequest<{ task: Task }>(`${base(ws)}/${id}/arquivar`, { method: "POST", body: { archived } }).then((r) => r.task),
  duplicate: (ws: string, id: string) => apiRequest<{ task: Task }>(`${base(ws)}/${id}/duplicar`, { method: "POST" }).then((r) => r.task),
  bulk: (ws: string, input: BulkTaskInput) =>
    apiRequest<{ ok: number; failed: Array<{ id: string; message: string }> }>(`${base(ws)}/lote`, { method: "POST", body: input }),
  activity: (ws: string, id: string) => apiRequest<Page<Activity>>(`${base(ws)}/${id}/atividades`),

  addChecklistItem: (ws: string, id: string, content: string) =>
    apiRequest<{ item: ChecklistItem }>(`${base(ws)}/${id}/checklist`, { method: "POST", body: { content } }).then((r) => r.item),
  updateChecklistItem: (ws: string, id: string, itemId: string, data: Partial<Pick<ChecklistItem, "content" | "done" | "position">>) =>
    apiRequest<{ item: ChecklistItem }>(`${base(ws)}/${id}/checklist/${itemId}`, { method: "PATCH", body: data }).then((r) => r.item),
  removeChecklistItem: (ws: string, id: string, itemId: string) =>
    apiRequest<void>(`${base(ws)}/${id}/checklist/${itemId}`, { method: "DELETE" }),
  addDependency: (ws: string, id: string, dependsOnId: string) =>
    apiRequest<void>(`${base(ws)}/${id}/dependencias`, { method: "POST", body: { dependsOnId } }),
  removeDependency: (ws: string, id: string, dependsOnId: string) =>
    apiRequest<void>(`${base(ws)}/${id}/dependencias/${dependsOnId}`, { method: "DELETE" }),
  follow: (ws: string, id: string, follow: boolean) => apiRequest<void>(`${base(ws)}/${id}/seguir`, { method: "POST", body: { follow } }),

  comments: (ws: string, id: string) => apiRequest<{ comments: Comment[] }>(`${base(ws)}/${id}/comentarios`).then((r) => r.comments),
  addComment: (ws: string, id: string, body: string, parentId?: string) =>
    apiRequest<{ comment: Comment }>(`${base(ws)}/${id}/comentarios`, { method: "POST", body: { body, parentId } }).then((r) => r.comment),
  editComment: (ws: string, id: string, commentId: string, body: string) =>
    apiRequest<{ comment: Comment }>(`${base(ws)}/${id}/comentarios/${commentId}`, { method: "PATCH", body: { body } }).then((r) => r.comment),
  removeComment: (ws: string, id: string, commentId: string) =>
    apiRequest<void>(`${base(ws)}/${id}/comentarios/${commentId}`, { method: "DELETE" }),
  react: (ws: string, id: string, commentId: string, emoji: string) =>
    apiRequest<{ comment: Comment }>(`${base(ws)}/${id}/comentarios/${commentId}/reacoes`, { method: "POST", body: { emoji } }),

  /** Legado: importa tarefas antigas do localStorage para o projeto "Minhas tarefas". */
  importLegacy: (tasks: CreateTaskInput[]) =>
    apiRequest<{ tasks: Task[] }>("/tarefas/importar", { method: "POST", body: { tasks } }).then((r) => r.tasks),
};
