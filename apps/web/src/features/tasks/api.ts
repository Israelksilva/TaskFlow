import type { CreateTaskInput, Task, UpdateTaskInput } from "@andamo/shared";
import { apiRequest } from "@/lib/api-client";

export const tasksApi = {
  list: (signal?: AbortSignal) =>
    apiRequest<{ tasks: Task[] }>("/tarefas", { signal }).then((r) => r.tasks),

  create: (input: CreateTaskInput) =>
    apiRequest<{ task: Task }>("/tarefas", { method: "POST", body: input }).then((r) => r.task),

  /** PATCH parcial: envie apenas os campos alterados. */
  update: (id: string, changes: UpdateTaskInput) =>
    apiRequest<{ task: Task }>(`/tarefas/${id}`, { method: "PATCH", body: changes }).then((r) => r.task),

  remove: (id: string) => apiRequest<void>(`/tarefas/${id}`, { method: "DELETE" }),

  importMany: (tasks: CreateTaskInput[]) =>
    apiRequest<{ tasks: Task[] }>("/tarefas/importar", { method: "POST", body: { tasks } }).then(
      (r) => r.tasks,
    ),
};
