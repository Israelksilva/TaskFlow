import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import {
  computeBoardStats,
  filterTasks,
  hasActiveFilters,
  type Task,
  type TaskFilters,
  type TaskStatus,
} from "@andamo/shared";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/features/auth/use-auth";
import { Button } from "@/components/ui/button";
import { getErrorMessage } from "@/lib/api-client";
import { pluralize } from "@/lib/format";
import { focusTaskCard, getNewTaskButton } from "@/lib/focus";
import { isTypingTarget } from "@/lib/hooks";
import { BoardError, BoardSkeleton, EmptyBoard, NoResults } from "../components/BoardStates";
import { DeleteTaskDialog } from "../components/DeleteTaskDialog";
import { LegacyImportBanner } from "../components/LegacyImportBanner";
import { TaskBoard, type DragCommit } from "../components/TaskBoard";
import { TaskFormDialog } from "../components/TaskFormDialog";
import { TaskToolbar } from "../components/TaskToolbar";
import { TASKS_KEY, useDeleteTask, useMoveTask, useTasks } from "../hooks";

function greeting(date = new Date()) {
  const h = date.getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

interface FormState {
  open: boolean;
  task: Task | null;
  status: TaskStatus;
  returnFocus: HTMLElement | null;
}

export default function TasksPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const firstName = user?.name.trim().split(/\s+/)[0];
  const tasksQuery = useTasks();
  const move = useMoveTask();
  const remove = useDeleteTask();
  const searchRef = useRef<HTMLInputElement>(null);

  const [filters, setFilters] = useState<TaskFilters>({});
  const [form, setForm] = useState<FormState>({ open: false, task: null, status: "todo", returnFocus: null });
  const [toDelete, setToDelete] = useState<{ task: Task; returnFocus: HTMLElement | null } | null>(null);

  const [params, setParams] = useSearchParams();

  const tasks = useMemo(() => tasksQuery.data ?? [], [tasksQuery.data]);
  const filtersActive = hasActiveFilters(filters);
  const visibleCount = useMemo(
    () => (filtersActive ? filterTasks(tasks, filters).length : tasks.length),
    [tasks, filters, filtersActive],
  );
  const stats = useMemo(() => computeBoardStats(tasks), [tasks]);

  const openCreate = useCallback((status: TaskStatus = "todo", returnFocus: HTMLElement | null = null) => {
    setForm({ open: true, task: null, status, returnFocus });
  }, []);

  const openEdit = useCallback((task: Task, returnFocus: HTMLElement | null) => {
    setForm({ open: true, task, status: task.status, returnFocus });
  }, []);

  const requestDelete = useCallback((task: Task, returnFocus: HTMLElement | null) => {
    setToDelete({ task, returnFocus });
  }, []);

  const handleMove = useCallback(
    (task: Task, status: TaskStatus, position: number) => {
      move.mutate({ task, status, position });
      focusTaskCard(task.id);
    },
    [move],
  );

  const handleDragCommit = useCallback(
    ({ task, status, position, items, rollback }: DragCommit) => {
      // Aplica na hora (sem "piscar"); o hook desfaz se a API falhar.
      qc.setQueryData(TASKS_KEY, items);
      move.mutate({ task, status, position, rollback });
    },
    [qc, move],
  );

  // Ações vindas da paleta de comandos e da criação rápida (?nova, ?buscar, ?editar=<id>).
  useEffect(() => {
    if (!["nova", "buscar", "editar"].some((k) => params.has(k))) return;
    const editId = params.get("editar");
    if (editId && tasksQuery.isPending) return; // espera as tarefas para abrir a edição
    if (params.has("nova")) openCreate("todo", getNewTaskButton());
    else if (params.has("buscar")) requestAnimationFrame(() => searchRef.current?.focus());
    else if (editId) {
      const task = tasks.find((t) => t.id === editId);
      if (task) openEdit(task, null);
    }
    setParams({}, { replace: true });
  }, [params, setParams, tasks, tasksQuery.isPending, openCreate, openEdit]);

  // Atalhos: N = nova tarefa, / = buscar.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target)) return;
      if (document.querySelector("[role=dialog], [role=alertdialog], [role=menu]")) return;
      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        openCreate("todo", getNewTaskButton());
      } else if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openCreate]);

  let content;
  if (tasksQuery.isPending) {
    content = <BoardSkeleton />;
  } else if (tasksQuery.isError && !tasksQuery.data) {
    content = (
      <BoardError
        message={getErrorMessage(tasksQuery.error)}
        onRetry={() => void tasksQuery.refetch()}
        retrying={tasksQuery.isFetching}
      />
    );
  } else if (tasks.length === 0) {
    content = <EmptyBoard onCreate={(el) => openCreate("todo", el)} />;
  } else {
    content = (
      <>
        {filtersActive && visibleCount === 0 && <NoResults onClear={() => setFilters({})} />}
        {!(filtersActive && visibleCount === 0) && (
          <TaskBoard
            tasks={tasks}
            filters={filters}
            filtersActive={filtersActive}
            onAdd={openCreate}
            onEdit={openEdit}
            onDelete={requestDelete}
            onMove={handleMove}
            onDragCommit={handleDragCommit}
          />
        )}
        {filtersActive && visibleCount > 0 && (
          <p className="mt-3 text-xs text-muted-foreground">
            Com filtros ativos, use o menu ⋯ do cartão para mover tarefas. Limpe os filtros para arrastar.
          </p>
        )}
      </>
    );
  }

  return (
    <div className="bg-brand-glow min-h-full">
       <div className="mx-auto w-full max-w-[1400px] px-4 pb-24 pt-6 sm:px-6 md:pb-10 lg:pt-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-primary">{greeting()}{firstName ? `, ${firstName}` : ""} 👋</p>
            <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight">Minhas tarefas</h1>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
              {tasksQuery.isPending ? (
                <span>Carregando…</span>
              ) : (
                <>
                  <span className="flex items-center gap-2">
                    <span
                      className="h-2 w-28 overflow-hidden rounded-full bg-muted ring-1 ring-border"
                      role="progressbar"
                      aria-label="Tarefas concluídas"
                      aria-valuenow={stats.completionRate}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <span
                        className="block h-full rounded-full bg-brand transition-[width] duration-500"
                        style={{ width: `${stats.completionRate}%` }}
                      />
                    </span>
                    <span className="font-medium text-foreground">{stats.completionRate}%</span> concluídas
                  </span>
                  <span>{pluralize(stats.total, "tarefa", "tarefas")}</span>
                  {stats.overdue > 0 && (
                    <span className="font-medium text-destructive">{pluralize(stats.overdue, "atrasada", "atrasadas")}</span>
                  )}
                  {stats.dueToday > 0 && <span className="font-medium text-warning">{stats.dueToday} para hoje</span>}
                </>
              )}
            </div>
          </div>
          <Button
            data-new-task-button
            variant="brand"
            size="lg"
            onClick={(e) => openCreate("todo", e.currentTarget)}
            className="hidden px-5 sm:inline-flex"
          >
            <Plus aria-hidden /> Nova tarefa
            <kbd className="ml-1 border-white/30 bg-white/15 text-white">N</kbd>
          </Button>
        </div>

        <div className="mt-5 space-y-4">
          <LegacyImportBanner />
          {tasks.length > 0 && (
            <TaskToolbar
              ref={searchRef}
              filters={filters}
              onChange={setFilters}
              active={filtersActive}
              visibleCount={visibleCount}
              totalCount={tasks.length}
            />
          )}
          {tasksQuery.isError && tasksQuery.data && (
            <p role="alert" className="text-sm text-destructive">
              Não foi possível atualizar a lista agora. Mostrando os dados mais recentes.
            </p>
          )}
          {content}
        </div>
       </div>

      {/* Celular: ação principal sempre ao alcance do polegar. */}
      <Button
        data-new-task-button
        size="lg"
        onClick={(e) => openCreate("todo", e.currentTarget)}
        variant="brand"
        className="fixed bottom-5 right-4 z-20 h-12 rounded-full px-5 shadow-lg sm:hidden"
      >
        <Plus aria-hidden /> Nova tarefa
      </Button>

      <TaskFormDialog
        open={form.open}
        onOpenChange={(open) => setForm((f) => ({ ...f, open }))}
        task={form.task}
        defaultStatus={form.status}
        returnFocus={form.returnFocus}
      />

      <DeleteTaskDialog
        task={toDelete?.task ?? null}
        returnFocus={toDelete?.returnFocus}
        onCancel={() => setToDelete(null)}
        onConfirm={(task) => {
          setToDelete(null);
          remove.mutate(task);
        }}
      />
    </div>
  );
}
