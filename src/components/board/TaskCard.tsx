import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Calendar, GripVertical, Pencil, Trash2 } from "lucide-react";
import { Task } from "@/types/board";
import { PriorityBadge } from "./PriorityBadge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TaskCardProps {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  isOverlay?: boolean;
}

export const TaskCard = ({ task, onEdit, onDelete, isOverlay }: TaskCardProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: { type: "task", task },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const formattedDate = task.dueDate
    ? new Date(task.dueDate + "T00:00:00").toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
      })
    : null;

  const isOverdue =
    task.dueDate &&
    task.columnId !== "done" &&
    new Date(task.dueDate + "T23:59:59") < new Date();

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative rounded-xl border border-border bg-card p-3.5 pb-12 shadow-card transition-smooth",
        "hover:shadow-elevated hover:-translate-y-0.5 hover:border-primary/30",
        isDragging && "opacity-40",
        isOverlay && "shadow-elevated ring-2 ring-primary rotate-2 cursor-grabbing"
      )}
    >
      <div className="flex items-start gap-2">
        <button
          {...attributes}
          {...listeners}
          aria-label="Arrastar tarefa"
          className="mt-0.5 -ml-1 cursor-grab touch-none rounded p-1 text-muted-foreground/40 opacity-0 transition-smooth hover:bg-muted hover:text-muted-foreground group-hover:opacity-100 active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <div className="flex-1 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-semibold leading-snug text-card-foreground">
              {task.title}
            </h3>
            <PriorityBadge priority={task.priority} />
          </div>

          {task.description && (
            <p className="line-clamp-2 text-xs text-muted-foreground">
              {task.description}
            </p>
          )}

          {formattedDate && (
            <div
              className={cn(
                "inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium",
                isOverdue ? "bg-destructive/10 text-destructive" : "text-muted-foreground"
              )}
            >
              <Calendar className="h-3 w-3" />
              {formattedDate}
              {isOverdue && " · atrasada"}
            </div>
          )}
        </div>
      </div>

      <div className="absolute right-2 bottom-2 flex gap-1 opacity-0 transition-smooth group-hover:opacity-100">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-primary"
          onClick={() => onEdit(task)}
          aria-label="Editar tarefa"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
          onClick={() => onDelete(task.id)}
          aria-label="Excluir tarefa"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
};