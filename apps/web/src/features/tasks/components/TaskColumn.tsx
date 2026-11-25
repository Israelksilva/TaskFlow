import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { AlertTriangle, ArrowLeft, ArrowRight, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { isOverWip, STATUS_LABELS, type BoardColumn, type Task } from "@andamo/shared";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { TaskCard, type TaskCardActions } from "./TaskCard";
import { STATUS_META } from "./task-meta";

/** Faixa colorida no topo: cor própria da coluna ou a da categoria. */
const ACCENT = {
  todo: "before:bg-status-todo/60",
  doing: "before:bg-brand",
  done: "before:bg-status-done",
} as const;

export interface ColumnActions {
  onEdit: (column: BoardColumn) => void;
  onDelete: (column: BoardColumn) => void;
  onShift: (column: BoardColumn, direction: -1 | 1) => void;
}

interface TaskColumnProps extends TaskCardActions {
  column: BoardColumn;
  isFirst: boolean;
  isLast: boolean;
  /** Tarefas visíveis (após filtros). */
  tasks: Task[];
  /** Total real da coluna, independente dos filtros. */
  totalInColumn: number;
  filtered: boolean;
  dragDisabled: boolean;
  onAdd: (column: BoardColumn, returnFocus: HTMLElement | null) => void;
  columnActions?: ColumnActions;
  /** No celular a coluna ocupa a tela e o cabeçalho vira aba. */
  hideHeader?: boolean;
  id?: string;
  labelledBy?: string;
  canCreate: boolean;
}

export function TaskColumn({
  column,
  isFirst,
  isLast,
  tasks,
  totalInColumn,
  filtered,
  dragDisabled,
  onAdd,
  columnActions,
  hideHeader,
  id,
  labelledBy,
  canCreate,
  ...actions
}: TaskColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: `column:${column.id}`, data: { type: "column", columnId: column.id } });
  const { icon: Icon, className: iconClass } = STATUS_META[column.category];
  const headingId = `column-${column.id}-heading`;
  const overWip = isOverWip(column, totalInColumn);

  return (
    <section
      id={id}
      role={labelledBy ? "tabpanel" : undefined}
      aria-labelledby={labelledBy ?? headingId}
      className={cn(
        "relative flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-card/60 shadow-sm backdrop-blur transition-colors dark:bg-card/40",
        !column.color && "before:absolute before:inset-x-0 before:top-0 before:h-1",
        !column.color && ACCENT[column.category],
        isOver && "border-primary/50 bg-primary/5",
        overWip && "border-destructive/50",
      )}
    >
      {column.color && <span aria-hidden className="absolute inset-x-0 top-0 h-1" style={{ background: column.color }} />}
      {!hideHeader && (
        <header className="flex items-center justify-between gap-2 px-3 pb-2 pt-4">
          <h2 id={headingId} className="flex min-w-0 items-center gap-2 font-display text-sm font-bold">
            <Icon className={cn("h-4 w-4 shrink-0", iconClass)} aria-hidden />
            <span className="truncate">{column.name}</span>
            <span
              className={cn(
                "shrink-0 rounded-full bg-background px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground ring-1 ring-border",
                overWip && "bg-destructive/10 text-destructive ring-destructive/40",
              )}
            >
              <span className="sr-only">, </span>
              {filtered ? `${tasks.length} de ${totalInColumn}` : totalInColumn}
              {column.wipLimit !== null && `/${column.wipLimit}`}
              <span className="sr-only"> tarefas{column.wipLimit !== null && `, limite ${column.wipLimit}`}</span>
            </span>
            {overWip && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" aria-label="Limite de tarefas excedido" />
                </TooltipTrigger>
                <TooltipContent>Limite de {column.wipLimit} tarefas excedido: conclua antes de puxar mais trabalho.</TooltipContent>
              </Tooltip>
            )}
          </h2>
          <div className="flex shrink-0 items-center">
            {canCreate && (
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" aria-label={`Nova tarefa em ${column.name}`} onClick={(e) => onAdd(column, e.currentTarget)}>
                <Plus aria-hidden />
              </Button>
            )}
            {columnActions && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" aria-label={`Opções da coluna ${column.name}`}>
                    <MoreHorizontal aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onSelect={() => columnActions.onEdit(column)}>
                    <Pencil className="mr-2 h-4 w-4" aria-hidden /> Editar coluna
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={isFirst} onSelect={() => columnActions.onShift(column, -1)}>
                    <ArrowLeft className="mr-2 h-4 w-4" aria-hidden /> Mover para a esquerda
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={isLast} onSelect={() => columnActions.onShift(column, 1)}>
                    <ArrowRight className="mr-2 h-4 w-4" aria-hidden /> Mover para a direita
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive focus:bg-destructive/10 focus:text-destructive" onSelect={() => columnActions.onDelete(column)}>
                    <Trash2 className="mr-2 h-4 w-4" aria-hidden /> Excluir coluna
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </header>
      )}

      <div ref={setNodeRef} className={cn("flex flex-1 flex-col gap-2 px-2 pb-2", hideHeader && "pt-2")}>
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          <ul className="flex flex-col gap-2" aria-label={`Tarefas em ${column.name}`}>
            {tasks.map((task) => (
              <li key={task.id}>
                <TaskCard task={task} columnSize={totalInColumn} dragDisabled={dragDisabled} {...actions} />
              </li>
            ))}
          </ul>
        </SortableContext>

        {tasks.length === 0 && (
          <p className="rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
            {filtered && totalInColumn > 0 ? "Nenhuma tarefa desta coluna corresponde aos filtros." : `Nenhuma tarefa em ${column.name}.`}
            <span className="sr-only"> Categoria: {STATUS_LABELS[column.category]}.</span>
          </p>
        )}

        {canCreate && (
          <Button variant="ghost" size="sm" className="mt-auto justify-start text-muted-foreground hover:text-foreground" onClick={(e) => onAdd(column, e.currentTarget)}>
            <Plus aria-hidden /> Adicionar tarefa
          </Button>
        )}
      </div>
    </section>
  );
}
