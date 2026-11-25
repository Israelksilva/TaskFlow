import {
  PRIORITY_WEIGHT,
  TASK_PRIORITIES,
  TASK_STATUSES,
  type TaskPriority,
  type TaskStatus,
} from "../constants";
import type { BoardStats } from "../types";
import { toISODate } from "./dates";

/** Forma mínima necessária para as regras de ordenação do quadro. */
export interface Orderable {
  id: string;
  status: TaskStatus;
  position: number;
}

export interface TaskLike extends Orderable {
  title: string;
  description: string | null;
  priority: TaskPriority;
  dueDate: string | null;
  assigneeIds?: string[];
  labelIds?: string[];
}

const statusIndex = (status: TaskStatus) => TASK_STATUSES.indexOf(status);

/** Ordena por coluna (na ordem do quadro) e, dentro da coluna, por posição. */
export function sortTasks<T extends Orderable>(tasks: readonly T[]): T[] {
  return [...tasks].sort(
    (a, b) => statusIndex(a.status) - statusIndex(b.status) || a.position - b.position,
  );
}

/** Agrupa tarefas por coluna, preservando a ordem por posição. */
export function groupByStatus<T extends Orderable>(tasks: readonly T[]): Record<TaskStatus, T[]> {
  const groups = Object.fromEntries(TASK_STATUSES.map((s) => [s, [] as T[]])) as Record<
    TaskStatus,
    T[]
  >;
  for (const task of sortTasks(tasks)) groups[task.status].push(task);
  return groups;
}

/**
 * Move uma tarefa para `toStatus` no índice `toIndex` e normaliza as posições
 * (0..n-1) de todas as colunas. Função pura: não altera a lista recebida.
 * O índice é limitado ao tamanho da coluna de destino.
 */
export function moveTask<T extends Orderable>(
  tasks: readonly T[],
  taskId: string,
  toStatus: TaskStatus,
  toIndex: number,
): T[] {
  const task = tasks.find((t) => t.id === taskId);
  if (!task) throw new Error(`Tarefa ${taskId} não encontrada`);

  const groups = groupByStatus(tasks);
  const source = groups[task.status];
  source.splice(
    source.findIndex((t) => t.id === taskId),
    1,
  );

  const target = groups[toStatus];
  const index = Math.max(0, Math.min(Math.trunc(toIndex), target.length));
  target.splice(index, 0, { ...task, status: toStatus });

  return normalizePositions(groups);
}

/** Remove uma tarefa e compacta as posições da coluna. */
export function removeTask<T extends Orderable>(tasks: readonly T[], taskId: string): T[] {
  return normalizePositions(groupByStatus(tasks.filter((t) => t.id !== taskId)));
}

function normalizePositions<T extends Orderable>(groups: Record<TaskStatus, T[]>): T[] {
  return TASK_STATUSES.flatMap((status) =>
    groups[status].map((t, position) => (t.position === position ? t : { ...t, position })),
  );
}

/** Compara duas listas e devolve as tarefas de `after` cujo status ou posição mudaram. */
export function diffOrder<T extends Orderable>(before: readonly T[], after: readonly T[]): T[] {
  const previous = new Map(before.map((t) => [t.id, t]));
  return after.filter((t) => {
    const old = previous.get(t.id);
    return !old || old.status !== t.status || old.position !== t.position;
  });
}

export function isTaskOverdue(
  task: Pick<TaskLike, "dueDate" | "status">,
  today: string = toISODate(),
): boolean {
  return task.dueDate !== null && task.status !== "done" && task.dueDate < today;
}

export function isTaskDueToday(
  task: Pick<TaskLike, "dueDate" | "status">,
  today: string = toISODate(),
): boolean {
  return task.status !== "done" && task.dueDate === today;
}

export interface TaskFilters {
  search?: string;
  priority?: TaskPriority | "all";
  onlyOverdue?: boolean;
  assigneeId?: string;
  labelId?: string;
}

/** Normaliza texto para busca sem diferenciar acentos e maiúsculas. */
export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

export function filterTasks<T extends TaskLike>(
  tasks: readonly T[],
  filters: TaskFilters,
  today: string = toISODate(),
): T[] {
  const term = filters.search ? normalizeText(filters.search) : "";
  return tasks.filter((task) => {
    if (filters.priority && filters.priority !== "all" && task.priority !== filters.priority) {
      return false;
    }
    if (filters.onlyOverdue && !isTaskOverdue(task, today)) return false;
    if (filters.assigneeId && !task.assigneeIds?.includes(filters.assigneeId)) return false;
    if (filters.labelId && !task.labelIds?.includes(filters.labelId)) return false;
    if (term) {
      const haystack = normalizeText(`${task.title} ${task.description ?? ""}`);
      if (!haystack.includes(term)) return false;
    }
    return true;
  });
}

export function hasActiveFilters(filters: TaskFilters): boolean {
  return Boolean(
    filters.search?.trim() ||
      (filters.priority && filters.priority !== "all") ||
      filters.onlyOverdue ||
      filters.assigneeId ||
      filters.labelId,
  );
}

/** Comparador: prioridade mais alta primeiro. */
export function compareByPriority(
  a: Pick<TaskLike, "priority">,
  b: Pick<TaskLike, "priority">,
): number {
  return PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
}

export function computeBoardStats(
  tasks: readonly TaskLike[],
  today: string = toISODate(),
): BoardStats {
  const byStatus = Object.fromEntries(TASK_STATUSES.map((s) => [s, 0])) as Record<
    TaskStatus,
    number
  >;
  const byPriority = Object.fromEntries(TASK_PRIORITIES.map((p) => [p, 0])) as Record<
    TaskPriority,
    number
  >;
  let overdue = 0;
  let dueToday = 0;

  for (const task of tasks) {
    byStatus[task.status] += 1;
    byPriority[task.priority] += 1;
    if (isTaskOverdue(task, today)) overdue += 1;
    if (isTaskDueToday(task, today)) dueToday += 1;
  }

  const total = tasks.length;
  const completed = byStatus.done;
  return {
    total,
    completed,
    overdue,
    dueToday,
    completionRate: total === 0 ? 0 : Math.round((completed / total) * 100),
    byStatus,
    byPriority,
  };
}
