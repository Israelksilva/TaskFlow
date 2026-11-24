import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { STATUS_LABELS, type Task, type TaskStatus } from "@andamo/shared";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TaskCard, type TaskCardActions } from "./TaskCard";
import { STATUS_META } from "./task-meta";

/** Faixa colorida no topo de cada coluna (o texto do status continua visível). */
const ACCENT: Record<TaskStatus, string> = {
  todo: "before:bg-status-todo/60",
  doing: "before:bg-brand",
  done: "before:bg-status-done",
};

interface TaskColumnProps extends TaskCardActions {
  status: TaskStatus;
  /** Tarefas visíveis (após filtros). */
  tasks: Task[];
  /** Total real da coluna, independente dos filtros. */
  totalInColumn: number;
  filtered: boolean;
  dragDisabled: boolean;
  onAdd: (status: TaskStatus, returnFocus: HTMLElement | null) => void;
  /** No celular a coluna ocupa a tela e o cabeçalho vira aba. */
  hideHeader?: boolean;
  id?: string;
  labelledBy?: string;
}

export function TaskColumn({
  status,
  tasks,
  totalInColumn,
  filtered,
  dragDisabled,
  onAdd,
  hideHeader,
  id,
  labelledBy,
  ...actions
}: TaskColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status, data: { type: "column", status } });
  const { icon: Icon, className: iconClass } = STATUS_META[status];
  const headingId = `column-${status}-heading`;

  return (
    <section
      id={id}
      role={labelledBy ? "tabpanel" : undefined}
      aria-labelledby={labelledBy ?? headingId}
      className={cn(
        "relative flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-card/60 shadow-sm backdrop-blur transition-colors dark:bg-card/40",
        "before:absolute before:inset-x-0 before:top-0 before:h-1",
        ACCENT[status],
        isOver && "border-primary/50 bg-primary/5",
      )}
    >
      {!hideHeader && (
        <header className="flex items-center justify-between gap-2 px-3 pb-2 pt-4">
          <h2 id={headingId} className="flex items-center gap-2 font-display text-sm font-bold">
            <Icon className={cn("h-4 w-4", iconClass)} aria-hidden />
            {STATUS_LABELS[status]}
            <span className="rounded-full bg-background px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground ring-1 ring-border">
              <span className="sr-only">, </span>
              {filtered ? `${tasks.length} de ${totalInColumn}` : totalInColumn}
              <span className="sr-only"> tarefas</span>
            </span>
          </h2>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground"
            aria-label={`Nova tarefa em ${STATUS_LABELS[status]}`}
            onClick={(e) => onAdd(status, e.currentTarget)}
          >
            <Plus aria-hidden />
          </Button>
        </header>
      )}

      <div ref={setNodeRef} className={cn("flex flex-1 flex-col gap-2 px-2 pb-2", hideHeader && "pt-2")}>
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          <ul className="flex flex-col gap-2" aria-label={`Tarefas em ${STATUS_LABELS[status]}`}>
            {tasks.map((task) => (
              <li key={task.id}>
                <TaskCard task={task} columnSize={totalInColumn} dragDisabled={dragDisabled} {...actions} />
              </li>
            ))}
          </ul>
        </SortableContext>

        {tasks.length === 0 && (
          <p className="rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
            {filtered && totalInColumn > 0
              ? "Nenhuma tarefa desta coluna corresponde aos filtros."
              : `Nenhuma tarefa em ${STATUS_LABELS[status]}.`}
          </p>
        )}

        <Button
          variant="ghost"
          size="sm"
          className="mt-auto justify-start text-muted-foreground hover:text-foreground"
          onClick={(e) => onAdd(status, e.currentTarget)}
        >
          <Plus aria-hidden /> Adicionar tarefa
        </Button>
      </div>
    </section>
  );
}
