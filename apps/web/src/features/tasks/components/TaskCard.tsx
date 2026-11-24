import { memo, useRef } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowRight, ArrowUp, GripVertical, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { STATUS_LABELS, TASK_STATUSES, type Task, type TaskStatus } from "@andamo/shared";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { DueDateBadge, PriorityBadge } from "./TaskBadges";
import { STATUS_META } from "./task-meta";

export interface TaskCardActions {
  onEdit: (task: Task, returnFocus: HTMLElement | null) => void;
  onDelete: (task: Task, returnFocus: HTMLElement | null) => void;
  onMove: (task: Task, status: TaskStatus, position: number) => void;
}

interface TaskCardProps extends TaskCardActions {
  task: Task;
  /** Quantidade real de tarefas na coluna (para habilitar "Mover para baixo"). */
  columnSize: number;
  dragDisabled?: boolean;
}

export const TaskCard = memo(function TaskCard({
  task,
  columnSize,
  dragDisabled,
  onEdit,
  onDelete,
  onMove,
}: TaskCardProps) {
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id, data: { type: "task", task }, disabled: dragDisabled });

  const isFirst = task.position === 0;
  const isLast = task.position >= columnSize - 1;
  const titleId = `task-${task.id}-title`;

  return (
    <article
      ref={setNodeRef}
      data-task-id={task.id}
      aria-labelledby={titleId}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "group relative rounded-xl border bg-card p-3 shadow-sm transition-[border-color,box-shadow,transform]",
        "hover:-translate-y-px hover:border-primary/40 hover:shadow-md hover:shadow-primary/5 focus-within:border-primary/40",
        task.status === "done" && "bg-card/70",
        isDragging && "opacity-40",
      )}
    >
      <div className="flex items-start gap-1.5">
        <button
          ref={setActivatorNodeRef}
          type="button"
          {...attributes}
          {...listeners}
          disabled={dragDisabled}
          aria-label={`Arrastar “${task.title}”`}
          className={cn(
            "-ml-1 mt-0.5 flex h-6 w-5 shrink-0 cursor-grab touch-none items-center justify-center rounded text-muted-foreground/60",
            "hover:bg-muted hover:text-foreground active:cursor-grabbing",
            "disabled:cursor-not-allowed disabled:opacity-30",
          )}
        >
          <GripVertical className="h-4 w-4" aria-hidden />
        </button>

        <div className="min-w-0 flex-1">
          <h3 id={titleId} className="text-sm font-medium leading-snug">
            <button
              type="button"
              data-card-focus
              onClick={(e) => onEdit(task, e.currentTarget)}
              className="rounded-sm text-left hover:text-primary hover:underline focus-visible:ring-offset-1"
            >
              <span className={cn("break-words [overflow-wrap:anywhere]", task.status === "done" && "text-muted-foreground line-through decoration-muted-foreground/50")}>
                {task.title}
              </span>
              <span className="sr-only">
                {" "}
                — status {STATUS_LABELS[task.status]}. Editar tarefa
              </span>
            </button>
          </h3>

          {task.description && (
            <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
              {task.description}
            </p>
          )}

          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <PriorityBadge priority={task.priority} />
            <DueDateBadge task={task} />
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              ref={menuTriggerRef}
              variant="ghost"
              size="icon"
              className="-mr-1.5 -mt-1 h-8 w-8 shrink-0 text-muted-foreground data-[state=open]:bg-accent"
              aria-label={`Ações da tarefa “${task.title}”`}
            >
              <MoreHorizontal aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onSelect={() => onEdit(task, menuTriggerRef.current)}>
              <Pencil className="mr-2 h-4 w-4" aria-hidden /> Editar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              Mover para
            </DropdownMenuLabel>
            {TASK_STATUSES.filter((s) => s !== task.status).map((status) => {
              const { icon: Icon, className } = STATUS_META[status];
              return (
                <DropdownMenuItem key={status} onSelect={() => onMove(task, status, Number.MAX_SAFE_INTEGER)}>
                  <Icon className={cn("mr-2 h-4 w-4", className)} aria-hidden />
                  {STATUS_LABELS[status]}
                  <ArrowRight className="ml-auto h-3.5 w-3.5 opacity-50" aria-hidden />
                </DropdownMenuItem>
              );
            })}
            <DropdownMenuItem disabled={isFirst} onSelect={() => onMove(task, task.status, task.position - 1)}>
              <ArrowUp className="mr-2 h-4 w-4" aria-hidden /> Mover para cima
            </DropdownMenuItem>
            <DropdownMenuItem disabled={isLast} onSelect={() => onMove(task, task.status, task.position + 1)}>
              <ArrowDown className="mr-2 h-4 w-4" aria-hidden /> Mover para baixo
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:bg-destructive/10 focus:text-destructive"
              onSelect={() => onDelete(task, menuTriggerRef.current)}
            >
              <Trash2 className="mr-2 h-4 w-4" aria-hidden /> Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </article>
  );
});

/** Versão estática exibida sob o cursor durante o arraste. */
export function TaskCardPreview({ task }: { task: Task }) {
  return (
    <div className="w-full rotate-2 cursor-grabbing rounded-xl border border-primary bg-card p-3 shadow-2xl shadow-primary/20 ring-2 ring-primary/20">
      <p className="text-sm font-medium [overflow-wrap:anywhere]">{task.title}</p>
      <div className="mt-2 flex items-center gap-3">
        <PriorityBadge priority={task.priority} />
        <DueDateBadge task={task} />
      </div>
    </div>
  );
}
