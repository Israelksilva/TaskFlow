import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "@/features/auth/use-auth";
import { useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  CalendarRange,
  Columns3,
  Copy,
  List,
  MoreHorizontal,
  Pencil,
  Plus,
  Table2,
  Target,
  Trash2,
} from "lucide-react";
import {
  can,
  computeBoardStats,
  filterTasks,
  hasActiveFilters,
  PROJECT_STATUS_LABELS,
  type Task,
  type TaskFilters,
  type TaskStatus,
} from "@andamo/shared";
import { InlineError } from "@/components/feedback/InlineError";
import { useCrumbs } from "@/components/layout/AppHeader";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BoardError, BoardSkeleton, EmptyBoard, NoResults } from "@/features/tasks/components/BoardStates";
import { DeleteTaskDialog } from "@/features/tasks/components/DeleteTaskDialog";
import { LegacyImportBanner } from "@/features/tasks/components/LegacyImportBanner";
import { BoardMetaContext } from "@/features/tasks/components/TaskCardMeta";
import { TaskBoard, type DragCommit } from "@/features/tasks/components/TaskBoard";
import { TaskFormDialog } from "@/features/tasks/components/TaskFormDialog";
import { TaskToolbar } from "@/features/tasks/components/TaskToolbar";
import { TaskListView, TaskTableView, TaskTimelineView } from "@/features/tasks/components/TaskViews";
import { BoardScopeContext, taskKeys, useDeleteTask, useMoveTask, useTasks, type BoardScope } from "@/features/tasks/hooks";
import { workspacesApi } from "@/features/workspaces/api";
import { useCurrentWorkspace, useLabels, useMembers, useProject, useWsMutation } from "@/features/workspaces/hooks";
import { getErrorMessage } from "@/lib/api-client";
import { focusTaskCard, getNewTaskButton } from "@/lib/focus";
import { isTypingTarget } from "@/lib/hooks";
import { pluralize } from "@/lib/format";
import { ProjectFormDialog } from "./components/ProjectFormDialog";

type View = "kanban" | "lista" | "tabela" | "timeline";
const VIEWS: Array<{ id: View; label: string; icon: typeof List }> = [
  { id: "kanban", label: "Kanban", icon: Columns3 },
  { id: "lista", label: "Lista", icon: List },
  { id: "tabela", label: "Tabela", icon: Table2 },
  { id: "timeline", label: "Timeline", icon: CalendarRange },
];

interface FormState {
  open: boolean;
  status: TaskStatus;
  returnFocus: HTMLElement | null;
}

function Board({ scope }: { scope: BoardScope }) {
  const ws = useCurrentWorkspace();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const view = (VIEWS.find((v) => v.id === params.get("visao"))?.id ?? "kanban") as View;
  const tasksQuery = useTasks();
  const move = useMoveTask();
  const remove = useDeleteTask();
  const membersQuery = useMembers(ws.id);
  const labelsQuery = useLabels(ws.id);
  const members = useMemo(() => membersQuery.data ?? [], [membersQuery.data]);
  const labels = useMemo(() => labelsQuery.data ?? [], [labelsQuery.data]);
  const searchRef = useRef<HTMLInputElement>(null);
  const [filters, setFilters] = useState<TaskFilters>({});
  const [form, setForm] = useState<FormState>({ open: false, status: "todo", returnFocus: null });
  const [toDelete, setToDelete] = useState<{ task: Task; returnFocus: HTMLElement | null } | null>(null);
  const canCreate = can(ws.role, "tasks.create");
  const canEdit = can(ws.role, "tasks.edit");

  const tasks = useMemo(() => tasksQuery.data ?? [], [tasksQuery.data]);
  const filtersActive = hasActiveFilters(filters);
  const visible = useMemo(() => (filtersActive ? filterTasks(tasks, filters) : tasks), [tasks, filters, filtersActive]);
  const stats = useMemo(() => computeBoardStats(tasks), [tasks]);
  const meta = useMemo(() => ({ members: new Map(members.map((m) => [m.id, m])), labels: new Map(labels.map((l) => [l.id, l])) }), [members, labels]);

  const openTask = useCallback(
    (task: Task) =>
      setParams((p) => {
        p.set("tarefa", task.id);
        return p;
      }),
    [setParams],
  );
  const openCreate = useCallback((status: TaskStatus = "todo", returnFocus: HTMLElement | null = null) => {
    if (canCreate) setForm({ open: true, status, returnFocus });
  }, [canCreate]);
  const handleMove = useCallback(
    (task: Task, status: TaskStatus, position: number) => {
      move.mutate({ task, status, position });
      focusTaskCard(task.id);
    },
    [move],
  );
  const handleDragCommit = useCallback(
    ({ task, status, position, items, rollback }: DragCommit) => {
      qc.setQueryData(taskKeys.board(scope), items);
      move.mutate({ task, status, position, rollback });
    },
    [qc, move, scope],
  );

  // Atalhos do quadro: N = nova tarefa na coluna "A Fazer", / = buscar.
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

  const setView = (v: string) =>
    setParams((p) => {
      p.set("visao", v);
      return p;
    });

  let content;
  if (tasksQuery.isPending) content = <BoardSkeleton />;
  else if (tasksQuery.isError && !tasksQuery.data) {
    content = <BoardError message={getErrorMessage(tasksQuery.error)} onRetry={() => void tasksQuery.refetch()} retrying={tasksQuery.isFetching} />;
  } else if (tasks.length === 0) {
    content = canCreate ? <EmptyBoard onCreate={(el) => openCreate("todo", el)} /> : <p className="text-sm text-muted-foreground">Este projeto ainda não tem tarefas.</p>;
  } else if (filtersActive && visible.length === 0) {
    content = <NoResults onClear={() => setFilters({})} />;
  } else if (view === "kanban") {
    content = (
      <>
        <TaskBoard
          tasks={tasks}
          filters={filters}
          filtersActive={filtersActive}
          onAdd={openCreate}
          onEdit={openTask}
          onDelete={(task, returnFocus) => setToDelete({ task, returnFocus })}
          onMove={handleMove}
          onDragCommit={handleDragCommit}
        />
        {filtersActive && <p className="mt-3 text-xs text-muted-foreground">Com filtros ativos, use o menu ⋯ do cartão para mover tarefas. Limpe os filtros para arrastar.</p>}
      </>
    );
  } else {
    const props = { tasks: visible, members, labels, workspaceId: ws.id, canEdit };
    content = view === "lista" ? <TaskListView {...props} /> : view === "tabela" ? <TaskTableView {...props} /> : <TaskTimelineView {...props} />;
  }

  return (
    <BoardMetaContext.Provider value={meta}>
      <div className="space-y-4" data-board-shortcuts>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <Tabs value={view} onValueChange={setView}>
            <TabsList aria-label="Visualização">
              {VIEWS.map((v) => (
                <TabsTrigger key={v.id} value={v.id}>
                  <v.icon /> <span className="hidden sm:inline">{v.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span>{pluralize(stats.total, "tarefa", "tarefas")}</span>
            <span><span className="font-medium text-foreground">{stats.completionRate}%</span> concluídas</span>
            {stats.overdue > 0 && <span className="font-medium text-destructive">{pluralize(stats.overdue, "atrasada", "atrasadas")}</span>}
            {canCreate && (
              <Button data-new-task-button size="sm" className="bg-brand text-white shadow-glow hover:brightness-110" onClick={(e) => openCreate("todo", e.currentTarget)}>
                <Plus /> Nova tarefa <kbd className="ml-1 border-white/30 bg-white/15 text-white">N</kbd>
              </Button>
            )}
          </div>
        </div>
        <LegacyImportBanner />
        {tasks.length > 0 && (
          <TaskToolbar ref={searchRef} filters={filters} onChange={setFilters} active={filtersActive} visibleCount={visible.length} totalCount={tasks.length} members={members} labels={labels} />
        )}
        {tasksQuery.isError && tasksQuery.data && <p role="alert" className="text-sm text-destructive">Não foi possível atualizar agora. Mostrando os dados mais recentes.</p>}
        {content}
      </div>

      <TaskFormDialog open={form.open} onOpenChange={(open) => setForm((f) => ({ ...f, open }))} task={null} defaultStatus={form.status} returnFocus={form.returnFocus} />
      <DeleteTaskDialog
        task={toDelete?.task ?? null}
        returnFocus={toDelete?.returnFocus}
        onCancel={() => setToDelete(null)}
        onConfirm={(task) => {
          setToDelete(null);
          remove.mutate(task);
        }}
      />
    </BoardMetaContext.Provider>
  );
}

export default function ProjectPage() {
  const ws = useCurrentWorkspace();
  const { projectId = "" } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const project = useProject(ws.id, projectId);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const scope = useMemo(() => ({ workspaceId: ws.id, projectId }), [ws.id, projectId]);
  const p = project.data;
  useCrumbs([{ label: ws.name, to: `/app/w/${ws.id}` }, { label: "Projetos", to: `/app/w/${ws.id}/projetos` }, { label: p?.name ?? "Projeto" }]);

  const invalidate = [["workspaces", ws.id]] as const;
  const duplicate = useWsMutation(() => workspacesApi.duplicateProject(ws.id, projectId), { invalidate, success: "Projeto duplicado" });
  const archive = useWsMutation((archived: boolean) => workspacesApi.archiveProject(ws.id, projectId, archived), { invalidate, success: (r) => (r.archivedAt ? "Projeto arquivado" : "Projeto restaurado") });
  const remove = useWsMutation(() => workspacesApi.deleteProject(ws.id, projectId), { invalidate, success: "Projeto excluído" });

  if (project.isError) {
    return (
      <div className="mx-auto max-w-3xl space-y-3 px-4 py-10">
        <InlineError>{getErrorMessage(project.error)}</InlineError>
        <Button asChild variant="outline"><Link to={`/app/w/${ws.id}/projetos`}>Voltar para projetos</Link></Button>
      </div>
    );
  }

  const canManage = p && (can(ws.role, "projects.manage") || (can(ws.role, "projects.create") && p.ownerId === user?.id));

  return (
    <BoardScopeContext.Provider value={scope}>
      <div className="mx-auto max-w-[1600px] space-y-5 px-4 py-6 sm:px-6">
        {!p ? (
          <Skeleton className="h-16 w-80" />
        ) : (
          <div className="flex items-start gap-4">
            <span className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg font-bold text-white shadow-sm" style={{ background: p.color }} aria-hidden>
              {p.name[0]?.toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">{p.name}</h1>
                <span className="rounded-full border px-2 py-0.5 text-xs font-medium text-muted-foreground">{PROJECT_STATUS_LABELS[p.status]}</span>
                {p.archivedAt && <span className="rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning">Arquivado</span>}
              </div>
              {p.goal && (
                <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground"><Target className="h-4 w-4" aria-hidden /> {p.goal}</p>
              )}
              <div className="mt-2 flex items-center gap-2">
                <div className="h-1.5 w-40 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={p.progress} aria-valuemin={0} aria-valuemax={100} aria-label="Progresso do projeto">
                  <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${p.progress}%`, background: p.color }} />
                </div>
                <span className="text-xs text-muted-foreground">{p.progress}%</span>
              </div>
            </div>
            {canManage && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" aria-label="Ações do projeto"><MoreHorizontal className="h-4 w-4" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => setEditing(true)}><Pencil className="mr-2 h-4 w-4" /> Editar projeto</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => duplicate.mutate(undefined)}><Copy className="mr-2 h-4 w-4" /> Duplicar</DropdownMenuItem>
                  {!p.isDefault && (
                    <DropdownMenuItem onSelect={() => archive.mutate(!p.archivedAt)}><Archive className="mr-2 h-4 w-4" /> {p.archivedAt ? "Desarquivar" : "Arquivar"}</DropdownMenuItem>
                  )}
                  {!p.isDefault && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive" onSelect={() => setConfirmDelete(true)}><Trash2 className="mr-2 h-4 w-4" /> Excluir projeto</DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        )}
        <Board scope={scope} />
      </div>
      <ProjectFormDialog open={editing} onOpenChange={setEditing} workspace={ws} project={p} />
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir “{p?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>O projeto e suas tarefas deixam de aparecer para todo o workspace. Esta ação é registrada no histórico.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => remove.mutate(undefined, { onSuccess: () => navigate(`/app/w/${ws.id}/projetos`) })}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </BoardScopeContext.Provider>
  );
}
