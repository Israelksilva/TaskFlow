import { useMemo } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { Column, Task } from "@/types/board";
import { TaskCard } from "./TaskCard";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface BoardColumnProps {
  column: Column;
  tasks: Task[];
  onAddTask: () => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (id: string) => void;
}

const columnBg: Record<string, string> = {
  todo: "bg-col-todo",
  doing: "bg-col-doing",
  done: "bg-col-done",
};

const accentBar: Record<string, string> = {
  todo: "bg-primary",
  doing: "bg-warning",
  done: "bg-success",
};

export const BoardColumn = ({
  column,
  tasks,
  onAddTask,
  onEditTask,
  onDeleteTask,
}: BoardColumnProps) => {
  const taskIds = useMemo(() => tasks.map((t) => t.id), [tasks]);

  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: { type: "column", column },
  });

  return (
    <div
      className={cn(
        "flex h-full w-[320px] shrink-0 flex-col rounded-2xl border border-border shadow-soft transition-smooth",
        columnBg[column.id],
        isOver && "ring-2 ring-primary ring-offset-2 ring-offset-background"
      )}
    >
      <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-3">
        <div className="flex items-center gap-2">
          <div className={cn("h-5 w-1 rounded-full", accentBar[column.id])} />
          <span className="text-lg">{column.emoji}</span>
          <h2 className="text-sm font-bold uppercase tracking-wide text-foreground/80">
            {column.title}
          </h2>
          <span className="rounded-full bg-background/70 px-2 py-0.5 text-[11px] font-semibold text-muted-foreground ring-1 ring-border">
            {tasks.length}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:bg-background/70 hover:text-primary"
          onClick={onAddTask}
          aria-label={`Adicionar tarefa em ${column.title}`}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div
        ref={setNodeRef}
        className="scrollbar-thin flex-1 space-y-2.5 overflow-y-auto px-3 pb-3"
      >
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onEdit={onEditTask}
              onDelete={onDeleteTask}
            />
          ))}
        </SortableContext>

        {tasks.length === 0 && (
          <button
            onClick={onAddTask}
            className="flex w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border/70 bg-background/40 py-10 text-xs text-muted-foreground transition-smooth hover:border-primary/40 hover:bg-background/70 hover:text-primary"
          >
            <Plus className="h-5 w-5" />
            Nenhuma tarefa. Clique para adicionar.
          </button>
        )}
      </div>
    </div>
  );
};
