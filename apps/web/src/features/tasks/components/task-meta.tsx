import { ArrowDown, ArrowUp, CheckCircle2, Circle, Minus, Timer, type LucideIcon } from "lucide-react";
import type { TaskPriority, TaskStatus } from "@andamo/shared";

/** Ícone + cor por status: o texto do status sempre acompanha (não depende só de cor). */
export const STATUS_META: Record<TaskStatus, { icon: LucideIcon; className: string }> = {
  todo: { icon: Circle, className: "text-status-todo" },
  doing: { icon: Timer, className: "text-status-doing" },
  done: { icon: CheckCircle2, className: "text-status-done" },
};

/** Ícone com forma distinta por prioridade (seta para cima/traço/seta para baixo). */
export const PRIORITY_META: Record<TaskPriority, { icon: LucideIcon; className: string }> = {
  alta: { icon: ArrowUp, className: "border-destructive/30 bg-destructive/10 text-destructive" },
  media: { icon: Minus, className: "border-warning/40 bg-warning/10 text-warning dark:text-warning" },
  baixa: { icon: ArrowDown, className: "border-border bg-muted text-muted-foreground" },
};
