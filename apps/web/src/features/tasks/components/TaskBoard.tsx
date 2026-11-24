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
import {
  STATUS_LABELS,
  TASK_STATUSES,
  filterTasks,
  groupByStatus,
  moveTask,
  type Task,
  type TaskFilters,
  type TaskStatus,
} from "@andamo/shared";
import { useMediaQuery } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import type { TaskCardActions } from "./TaskCard";
import { TaskCardPreview } from "./TaskCard";
import { TaskColumn } from "./TaskColumn";
import { STATUS_META } from "./task-meta";

export interface DragCommit {
  task: Task;
  status: TaskStatus;
  position: number;
  /** Quadro já reorganizado (aplicado na tela imediatamente). */
  items: Task[];
  /** Quadro antes do arraste (restaurado se a API falhar). */
  rollback: Task[];
}

interface TaskBoardProps extends TaskCardActions {
  tasks: Task[];
  filters: TaskFilters;
  filtersActive: boolean;
  onAdd: (status: TaskStatus, returnFocus: HTMLElement | null) => void;
  onDragCommit: (commit: DragCommit) => void;
}

interface DragState {
  items: Task[];
  original: Task;
  snapshot: Task[];
}

export function TaskBoard({ tasks, filters, filtersActive, onAdd, onDragCommit, ...actions }: TaskBoardProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [mobileStatus, setMobileStatus] = useState<TaskStatus>("todo");
  const [drag, setDrag] = useState<DragState | null>(null);
  const tabRefs = useRef<Partial<Record<TaskStatus, HTMLButtonElement | null>>>({});

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const items = drag?.items ?? tasks;
  const totals = useMemo(() => groupByStatus(items), [items]);
  const visible = useMemo(
    () => groupByStatus(filtersActive ? filterTasks(items, filters) : items),
    [items, filters, filtersActive],
  );
  // Com filtros, a ordem visível não é a ordem real: reordenar só pelo menu.
  const dragDisabled = filtersActive;

  const titleOf = (id: string | number) => items.find((t) => t.id === id)?.title ?? "tarefa";
  const describeTarget = (data: Record<string, unknown> | undefined, id: string | number) => {
    if (data?.type === "column") return `coluna ${STATUS_LABELS[data.status as TaskStatus]}`;
    const t = items.find((x) => x.id === id);
    return t ? `posição ${t.position + 1} de ${STATUS_LABELS[t.status]}` : "quadro";
  };

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Tarefa “${titleOf(active.id)}” selecionada para mover.`,
    onDragOver: ({ active, over }) =>
      over ? `“${titleOf(active.id)}” sobre ${describeTarget(over.data.current, over.id)}.` : "Fora das colunas.",
    onDragEnd: ({ active, over }) =>
      over ? `“${titleOf(active.id)}” solta em ${describeTarget(over.data.current, over.id)}.` : "Movimento cancelado.",
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
      const data = over.data.current;

      if (data?.type === "column") {
        const status = data.status as TaskStatus;
        if (status === current.status) return state;
        return { ...state, items: moveTask(state.items, current.id, status, Number.MAX_SAFE_INTEGER) };
      }
      if (data?.type === "task") {
        const target = state.items.find((t) => t.id === over.id);
        if (!target || target.status === current.status) return state;
        return { ...state, items: moveTask(state.items, current.id, target.status, target.position) };
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
      if (target && target.status === current.status) {
        next = moveTask(next, current.id, current.status, target.position);
      }
    }

    const final = next.find((t) => t.id === active.id)!;
    if (final.status === state.original.status && final.position === state.original.position) return;
    onDragCommit({
      task: state.original,
      status: final.status,
      position: final.position,
      items: next,
      rollback: state.snapshot,
    });
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const delta = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!delta) return;
    event.preventDefault();
    const next = TASK_STATUSES[(index + delta + TASK_STATUSES.length) % TASK_STATUSES.length];
    setMobileStatus(next);
    tabRefs.current[next]?.focus();
  }

  const columnProps = (status: TaskStatus) => ({
    status,
    tasks: visible[status],
    totalInColumn: totals[status].length,
    filtered: filtersActive,
    dragDisabled,
    onAdd,
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
          draggable:
            "Para mover a tarefa, pressione espaço. Use as setas para escolher a posição, espaço para soltar ou Esc para cancelar.",
        },
      }}
    >
      {isDesktop ? (
        <div className="grid grid-cols-3 items-start gap-4">
          {TASK_STATUSES.map((status) => (
            <TaskColumn key={status} {...columnProps(status)} />
          ))}
        </div>
      ) : (
        <div>
          {/* Celular: uma coluna por vez, escolhida por abas (sem rolagem horizontal). */}
          <div role="tablist" aria-label="Colunas do quadro" className="mb-3 grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
            {TASK_STATUSES.map((status, index) => {
              const { icon: Icon, className } = STATUS_META[status];
              const selected = status === mobileStatus;
              return (
                <button
                  key={status}
                  ref={(el) => (tabRefs.current[status] = el)}
                  role="tab"
                  id={`tab-${status}`}
                  aria-selected={selected}
                  aria-controls={`panel-${status}`}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setMobileStatus(status)}
                  onKeyDown={(e) => handleTabKeyDown(e, index)}
                  className={cn(
                    "flex min-w-0 items-center justify-center gap-1.5 rounded-md px-1 py-2 text-xs font-medium transition-colors",
                    selected ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className={cn("hidden h-3.5 w-3.5 shrink-0 min-[480px]:block", className)} aria-hidden />
                  <span className="truncate">{STATUS_LABELS[status]}</span>
                  <span className="tabular-nums text-muted-foreground">{visible[status].length}</span>
                </button>
              );
            })}
          </div>
          <TaskColumn
            {...columnProps(mobileStatus)}
            hideHeader
            id={`panel-${mobileStatus}`}
            labelledBy={`tab-${mobileStatus}`}
          />
        </div>
      )}

      <DragOverlay dropAnimation={null}>
        {drag ? <TaskCardPreview task={drag.original} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
