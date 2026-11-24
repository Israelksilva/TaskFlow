import { CalendarDays } from "lucide-react";
import {
  PRIORITY_LABELS,
  isTaskDueToday,
  isTaskOverdue,
  type Task,
  type TaskPriority,
} from "@andamo/shared";
import { describeDueDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PRIORITY_META } from "./task-meta";

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const { icon: Icon, className } = PRIORITY_META[priority];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium",
        className,
      )}
    >
      <Icon className="h-3 w-3" aria-hidden />
      <span className="sr-only">Prioridade </span>
      {PRIORITY_LABELS[priority]}
    </span>
  );
}

export function DueDateBadge({ task }: { task: Pick<Task, "dueDate" | "status"> }) {
  if (!task.dueDate) return null;
  const overdue = isTaskOverdue(task);
  const today = isTaskDueToday(task);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs",
        overdue ? "font-medium text-destructive" : today ? "font-medium text-warning" : "text-muted-foreground",
      )}
    >
      <CalendarDays className="h-3.5 w-3.5" aria-hidden />
      <span className="sr-only">Prazo: </span>
      {overdue && "Atrasada · "}
      {describeDueDate(task.dueDate)}
    </span>
  );
}
