import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { filterTasks, groupByColumn, moveToColumn, resolveColumnId, type BoardColumn, type Task, type TaskFilters } from "@andamo/shared";
import { useMediaQuery } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import type { TaskCardActions } from "./TaskCard";
import { TaskCardPreview } from "./TaskCard";
import { TaskColumn, type ColumnActions } from "./TaskColumn";

export interface DragCommit {
  task: Task;
  columnId: string;
  position: number;
  /** Quadro já reorganizado (aplicado na tela imediatamente). */
  items: Task[];
  /** Quadro antes do arraste (restaurado se a API falhar). */
  rollback: Task[];
}

interface TaskBoardProps extends TaskCardActions {
  tasks: Task[];
  columns: BoardColumn[];
  filters: TaskFilters;
  filtersActive: boolean;
  canCreate: boolean;
  onAdd: (column: BoardColumn, returnFocus: HTMLElement | null) => void;
  onDragCommit: (commit: DragCommit) => void;
  /** Presentes apenas para quem pode gerenciar o projeto. */
  columnActions?: ColumnActions;
  onAddColumn?: () => void;
}

interface DragState {
  items: Task[];
  original: Task;
  snapshot: Task[];
}

export function TaskBoard({ tasks, columns, filters, filtersActive, canCreate, onAdd, onDragCommit, columnActions, onAddColumn, ...actions }: TaskBoardProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [mobileColumn, setMobileColumn] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const items = drag?.items ?? tasks;
  const totals = useMemo(() => groupByColumn(items, columns), [items, columns]);
  const visible = useMemo(() => groupByColumn(filtersActive ? filterTasks(items, filters) : items, columns), [items, columns, filters, filtersActive]);
  // Com filtros, a ordem visível não é a ordem real: reordenar só pelo menu.
  const dragDisabled = filtersActive;
  const currentMobile = columns.find((c) => c.id === mobileColumn) ?? columns[0];

  const nameOf = (id: string | null | undefined) => columns.find((c) => c.id === id)?.name ?? "coluna";
  const titleOf = (id: string | number) => items.find((t) => t.id === id)?.title ?? "tarefa";
  const describeTarget = (data: Record<string, unknown> | undefined, id: string | number) => {
    if (data?.type === "column") return `coluna ${nameOf(data.columnId as string)}`;
    const t = items.find((x) => x.id === id);
    return t ? `posição ${t.position + 1} de ${nameOf(resolveColumnId(t, columns))}` : "quadro";
  };

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Tarefa “${titleOf(active.id)}” selecionada para mover.`,
    onDragOver: ({ active, over }) => (over ? `“${titleOf(active.id)}” sobre ${describeTarget(over.data.current, over.id)}.` : "Fora das colunas."),
    onDragEnd: ({ active, over }) => (over ? `“${titleOf(active.id)}” solta em ${describeTarget(over.data.current, over.id)}.` : "Movimento cancelado."),
    onDragCancel: ({ active }) => `Movimento de “${titleOf(active.id)}” cancelado.`,
  };

  function handleDragStart({ active }: DragStartEvent) {
    const original = tasks.find((t) => t.id === active.id);
    if (original) setDrag({ items: tasks, original, snapshot: tasks });
  }

  // Entre colunas, reposiciona durante o arraste para mostrar onde a tarefa vai cair.
  function handleDragOver({ active, over }: DragOverEvent) {
    if (!over) return;
    setDrag((state) => {
      if (!state) return state;
      const current = state.items.find((t) => t.id === active.id);
      if (!current) return state;
      const from = resolveColumnId(current, columns);
      const data = over.data.current;
      if (data?.type === "column") {
        const to = data.columnId as string;
        if (to === from) return state;
        return { ...state, items: moveToColumn(state.items, current.id, to, Number.MAX_SAFE_INTEGER, columns) };
      }
      if (data?.type === "task") {
        const target = state.items.find((t) => t.id === over.id);
        const to = target ? resolveColumnId(target, columns) : null;
        if (!target || !to || to === from) return state;
        return { ...state, items: moveToColumn(state.items, current.id, to, target.position, columns) };
      }
      return state;
    });
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    const state = drag;
    setDrag(null);
    if (!state || !over) return;

    let next = state.items;
    const current = next.find((t) => t.id === active.id);
    if (!current) return;

    // Reordenação dentro da mesma coluna é resolvida ao soltar.
    if (over.data.current?.type === "task" && over.id !== active.id) {
      const target = next.find((t) => t.id === over.id);
      const column = resolveColumnId(current, columns);
      if (target && column && resolveColumnId(target, columns) === column) {
        next = moveToColumn(next, current.id, column, target.position, columns);
      }
    }

    const final = next.find((t) => t.id === active.id)!;
    const finalColumn = resolveColumnId(final, columns)!;
    if (finalColumn === resolveColumnId(state.original, columns) && final.position === state.original.position) return;
    onDragCommit({ task: state.original, columnId: finalColumn, position: final.position, items: next, rollback: state.snapshot });
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const delta = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!delta) return;
    event.preventDefault();
    const next = columns[(index + delta + columns.length) % columns.length];
    setMobileColumn(next.id);
    tabRefs.current[next.id]?.focus();
  }

  const columnProps = (column: BoardColumn, index: number) => ({
    column,
    isFirst: index === 0,
    isLast: index === columns.length - 1,
    tasks: visible[column.id] ?? [],
    totalInColumn: totals[column.id]?.length ?? 0,
    filtered: filtersActive,
    dragDisabled,
    onAdd,
    canCreate,
    columnActions,
    ...actions,
  });

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setDrag(null)}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable: "Para mover a tarefa, pressione espaço. Use as setas para escolher a posição, espaço para soltar ou Esc para cancelar.",
        },
      }}
    >
      {isDesktop ? (
        // Colunas de largura fixa com rolagem horizontal quando não couberem na tela.
        <div className="scrollbar-thin -mx-1 flex items-start gap-4 overflow-x-auto px-1 pb-3">
          {columns.map((column, index) => (
            <div key={column.id} className={cn("shrink-0", columns.length <= 3 ? "min-w-[280px] flex-1" : "w-[300px]")}>
              <TaskColumn {...columnProps(column, index)} />
            </div>
          ))}
          {onAddColumn && (
            <button
              onClick={onAddColumn}
              className="flex h-24 w-[220px] shrink-0 items-center justify-center gap-2 rounded-2xl border border-dashed text-sm font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-foreground"
            >
              <Plus className="h-4 w-4" aria-hidden /> Adicionar coluna
            </button>
          )}
        </div>
      ) : (
        currentMobile && (
          <div>
            {/* Celular: uma coluna por vez, escolhida por abas roláveis. */}
            <div role="tablist" aria-label="Colunas do quadro" className="scrollbar-thin mb-3 flex gap-1 overflow-x-auto rounded-lg bg-muted p-1">
              {columns.map((column, index) => {
                const selected = column.id === currentMobile.id;
                return (
                  <button
                    key={column.id}
                    ref={(el) => (tabRefs.current[column.id] = el)}
                    role="tab"
                    id={`tab-${column.id}`}
                    aria-selected={selected}
                    aria-controls={`panel-${column.id}`}
                    tabIndex={selected ? 0 : -1}
                    onClick={() => setMobileColumn(column.id)}
                    onKeyDown={(e) => handleTabKeyDown(e, index)}
                    className={cn(
                      "flex shrink-0 items-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-colors",
                      selected ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <span className="max-w-[9rem] truncate">{column.name}</span>
                    <span className="tabular-nums text-muted-foreground">{visible[column.id]?.length ?? 0}</span>
                  </button>
                );
              })}
              {onAddColumn && (
                <button onClick={onAddColumn} className="shrink-0 rounded-md px-2 text-muted-foreground" aria-label="Adicionar coluna">
                  <Plus className="h-4 w-4" />
                </button>
              )}
            </div>
            <TaskColumn {...columnProps(currentMobile, columns.indexOf(currentMobile))} hideHeader id={`panel-${currentMobile.id}`} labelledBy={`tab-${currentMobile.id}`} />
          </div>
        )
      )}

      <DragOverlay dropAnimation={null}>{drag ? <TaskCardPreview task={drag.original} /> : null}</DragOverlay>
    </DndContext>
  );
}
