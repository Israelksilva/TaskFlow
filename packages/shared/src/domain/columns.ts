import type { TaskStatus } from "../constants";

/** Coluna personalizável do quadro. `category` liga a coluna a um dos três estados da tarefa. */
export interface BoardColumn {
  id: string;
  projectId: string;
  name: string;
  category: TaskStatus;
  position: number;
  /** Limite de tarefas (WIP); `null` = sem limite. */
  wipLimit: number | null;
  color: string | null;
}

export interface ColumnOrderable {
  id: string;
  columnId: string | null;
  status: TaskStatus;
  position: number;
}

const CATEGORY_ORDER: Record<TaskStatus, number> = { todo: 0, doing: 1, done: 2 };

export function sortColumns<C extends Pick<BoardColumn, "position" | "category">>(columns: readonly C[]): C[] {
  return [...columns].sort((a, b) => a.position - b.position || CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category]);
}

/** Coluna em que uma tarefa aparece: a sua, ou a primeira com a categoria do status (dados antigos). */
export function resolveColumnId<C extends Pick<BoardColumn, "id" | "category" | "position">>(
  task: Pick<ColumnOrderable, "columnId" | "status">,
  columns: readonly C[],
): string | null {
  if (task.columnId && columns.some((c) => c.id === task.columnId)) return task.columnId;
  return sortColumns(columns).find((c) => c.category === task.status)?.id ?? sortColumns(columns)[0]?.id ?? null;
}

/** Agrupa tarefas por coluna (todas as colunas presentes, mesmo vazias), ordenadas por posição. */
export function groupByColumn<T extends ColumnOrderable>(
  tasks: readonly T[],
  columns: readonly Pick<BoardColumn, "id" | "category" | "position">[],
): Record<string, T[]> {
  const groups: Record<string, T[]> = Object.fromEntries(columns.map((c) => [c.id, [] as T[]]));
  for (const task of tasks) {
    const id = resolveColumnId(task, columns);
    if (id) groups[id].push(task);
  }
  for (const id of Object.keys(groups)) groups[id].sort((a, b) => a.position - b.position);
  return groups;
}

/**
 * Move a tarefa para `toColumnId` no índice `toIndex` (limitado ao tamanho da coluna) e
 * normaliza as posições 0..n-1 de cada coluna. O status passa a ser a categoria da coluna.
 * Função pura: não altera a lista recebida.
 */
export function moveToColumn<T extends ColumnOrderable>(
  tasks: readonly T[],
  taskId: string,
  toColumnId: string,
  toIndex: number,
  columns: readonly Pick<BoardColumn, "id" | "category" | "position">[],
): T[] {
  const task = tasks.find((t) => t.id === taskId);
  const target = columns.find((c) => c.id === toColumnId);
  if (!task) throw new Error(`Tarefa ${taskId} não encontrada`);
  if (!target) throw new Error(`Coluna ${toColumnId} não encontrada`);

  const groups = groupByColumn(tasks, columns);
  const fromId = resolveColumnId(task, columns)!;
  groups[fromId] = groups[fromId].filter((t) => t.id !== taskId);
  const dest = groups[toColumnId];
  const index = Math.max(0, Math.min(Math.trunc(toIndex), dest.length));
  dest.splice(index, 0, { ...task, columnId: toColumnId, status: target.category });

  return sortColumns(columns).flatMap((c) =>
    groups[c.id].map((t, position) => (t.position === position && t.columnId === c.id ? t : { ...t, position, columnId: c.id })),
  );
}

/** Tarefas de `after` cuja coluna, status ou posição mudaram em relação a `before`. */
export function diffColumnOrder<T extends ColumnOrderable>(before: readonly T[], after: readonly T[]): T[] {
  const previous = new Map(before.map((t) => [t.id, t]));
  return after.filter((t) => {
    const old = previous.get(t.id);
    return !old || old.columnId !== t.columnId || old.position !== t.position || old.status !== t.status;
  });
}

/** WIP excedido? (limite é aviso visual; a API não bloqueia para não travar o fluxo da equipe). */
export function isOverWip(column: Pick<BoardColumn, "wipLimit">, count: number): boolean {
  return column.wipLimit !== null && count > column.wipLimit;
}

export const DEFAULT_COLUMNS: ReadonlyArray<Pick<BoardColumn, "name" | "category">> = [
  { name: "A Fazer", category: "todo" },
  { name: "Em Progresso", category: "doing" },
  { name: "Concluído", category: "done" },
];
