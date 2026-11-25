import { forwardRef } from "react";
import { AlertTriangle, Search, X } from "lucide-react";
import { PRIORITY_LABELS, TASK_PRIORITIES, type Label as TaskLabel, type Member, type TaskFilters, type TaskPriority } from "@andamo/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface TaskToolbarProps {
  filters: TaskFilters;
  onChange: (filters: TaskFilters) => void;
  active: boolean;
  visibleCount: number;
  totalCount: number;
  members?: Array<Pick<Member, "id" | "name">>;
  labels?: TaskLabel[];
}

export const TaskToolbar = forwardRef<HTMLInputElement, TaskToolbarProps>(
  ({ filters, onChange, active, visibleCount, totalCount, members, labels }, searchRef) => (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center" role="search">
      <div className="relative sm:w-64">
        <Label htmlFor="task-search" className="sr-only">
          Buscar tarefas
        </Label>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          ref={searchRef}
          id="task-search"
          type="search"
          value={filters.search ?? ""}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          placeholder="Buscar tarefas"
          className="h-9 pl-9 pr-10"
        />
        <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 sm:inline-flex" aria-hidden>
          /
        </kbd>
      </div>

      <div className="flex items-center gap-2">
        <Label htmlFor="filter-priority" className="sr-only">
          Filtrar por prioridade
        </Label>
        <Select
          value={filters.priority ?? "all"}
          onValueChange={(v) => onChange({ ...filters, priority: v as TaskPriority | "all" })}
        >
          <SelectTrigger id="filter-priority" className="h-9 w-full sm:w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as prioridades</SelectItem>
            {[...TASK_PRIORITIES].reverse().map((p) => (
              <SelectItem key={p} value={p}>
                Prioridade {PRIORITY_LABELS[p].toLowerCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-pressed={Boolean(filters.onlyOverdue)}
          onClick={() => onChange({ ...filters, onlyOverdue: !filters.onlyOverdue })}
          className={cn(
            "h-9 shrink-0",
            filters.onlyOverdue && "border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/15 hover:text-destructive",
          )}
        >
          <AlertTriangle aria-hidden /> Atrasadas
        </Button>
      </div>

      {members && members.length > 1 && (
        <Select value={filters.assigneeId ?? "all"} onValueChange={(v) => onChange({ ...filters, assigneeId: v === "all" ? undefined : v })}>
          <SelectTrigger className="h-9 w-full sm:w-44" aria-label="Filtrar por responsável">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os responsáveis</SelectItem>
            {members.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {labels && labels.length > 0 && (
        <Select value={filters.labelId ?? "all"} onValueChange={(v) => onChange({ ...filters, labelId: v === "all" ? undefined : v })}>
          <SelectTrigger className="h-9 w-full sm:w-40" aria-label="Filtrar por etiqueta">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as etiquetas</SelectItem>
            {labels.map((l) => (
              <SelectItem key={l.id} value={l.id}>
                {l.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {active && (
        <div className="flex items-center gap-2 sm:ml-auto">
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {visibleCount} de {totalCount} tarefas
          </p>
          <Button variant="ghost" size="sm" className="h-9" onClick={() => onChange({})}>
            <X aria-hidden /> Limpar filtros
          </Button>
        </div>
      )}
    </div>
  ),
);
TaskToolbar.displayName = "TaskToolbar";
