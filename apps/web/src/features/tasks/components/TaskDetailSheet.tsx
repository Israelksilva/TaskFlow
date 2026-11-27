import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  ArchiveRestore,
  Bell,
  BellOff,
  CalendarClock,
  CheckSquare,
  Copy,
  Flag,
  GitBranch,
  History,
  Link2,
  ListTree,
  MessageSquare,
  MoreHorizontal,
  Plus,
  Repeat,
  RotateCcw,
  Timer,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  can,
  PRIORITY_LABELS,
  RECURRENCE_LABELS,
  RECURRENCES,
  STATUS_LABELS,
  TASK_PRIORITIES,
  TASK_STATUSES,
  type TaskDetail,
  type UpdateTaskInput,
  type Workspace,
} from "@andamo/shared";
import { MarkdownEditor, MarkdownView } from "@/components/editor/MarkdownEditor";
import { AvatarStack } from "@/components/feedback/UserAvatar";
import { InlineError } from "@/components/feedback/InlineError";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/features/auth/use-auth";
import { AttachmentsPanel } from "@/features/files/AttachmentsPanel";
import { onPresence, sendPresence } from "@/features/realtime/use-realtime";
import { workspacesApi } from "@/features/workspaces/api";
import { useLabels, useMembers, useProjects, wsKeys } from "@/features/workspaces/hooks";
import { ApiError, getErrorMessage } from "@/lib/api-client";
import { formatDateTime, relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { tasksApi } from "../api";
import { taskKeys } from "../hooks";
import { TaskTimeSection } from "@/features/time/components/TaskTimeSection";
import { LabelPicker, MemberPicker } from "./Pickers";
import { STATUS_META } from "./task-meta";
import { TaskComments } from "./TaskComments";

const ACTIVITY_LABELS: Record<string, string> = {
  "task.created": "criou a tarefa",
  "task.updated": "editou a tarefa",
  "task.completed": "concluiu a tarefa",
  "task.deleted": "enviou para a lixeira",
  "task.restored": "restaurou a tarefa",
  "task.archived": "arquivou a tarefa",
  "task.unarchived": "desarquivou a tarefa",
  "comment.created": "comentou",
};

const FIELD_LABELS: Record<string, string> = {
  title: "título",
  description: "descrição",
  priority: "prioridade",
  status: "status",
  dueDate: "prazo",
  startDate: "início",
  dueTime: "hora",
  estimateMinutes: "estimativa",
  recurrence: "recorrência",
  assigneeIds: "responsáveis",
  labelIds: "etiquetas",
  projectId: "projeto",
};

function Row({ icon: Icon, label, children }: { icon: typeof Flag; label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_1fr] items-center gap-2 text-sm sm:grid-cols-[140px_1fr]">
      <span className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" aria-hidden /> {label}
      </span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function DetailBody({ task, workspace, close }: { task: TaskDetail; workspace: Workspace; close: () => void }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const members = useMembers(workspace.id).data ?? [];
  const labels = useLabels(workspace.id).data ?? [];
  const projects = useProjects(workspace.id).data ?? [];
  const [title, setTitle] = useState(task.title);
  const [editingDesc, setEditingDesc] = useState(false);
  const [description, setDescription] = useState(task.description ?? "");
  const [newItem, setNewItem] = useState("");
  const [newSubtask, setNewSubtask] = useState("");
  const [viewers, setViewers] = useState<string[]>([]);
  const isAssigned = task.assigneeIds.includes(user!.id);
  const editable = !task.deletedAt && (can(workspace.role, "tasks.edit") || (can(workspace.role, "tasks.editAssigned") && isAssigned));
  const following = task.followerIds.includes(user!.id);

  useEffect(() => setTitle(task.title), [task.title]);
  useEffect(() => {
    if (!editingDesc) setDescription(task.description ?? "");
  }, [task.description, editingDesc]);

  // Presença: avisa que esta tarefa está aberta e mostra quem mais está vendo.
  useEffect(() => {
    sendPresence(task.id);
    const off = onPresence((taskId, ids) => taskId === task.id && setViewers(ids.filter((id) => id !== user!.id)));
    return () => {
      off();
      sendPresence(null);
    };
  }, [task.id, user]);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["tasks", workspace.id] });
    void qc.invalidateQueries({ queryKey: wsKeys.dashboard(workspace.id) });
    void qc.invalidateQueries({ queryKey: ["workspaces", workspace.id, "projects"] });
  };
  const onError = (error: unknown) => {
    if (error instanceof ApiError && error.code === "EDIT_CONFLICT") {
      toast.warning("Outra pessoa alterou esta tarefa", { description: "Carregamos a versão mais recente. Revise e tente de novo." });
    } else toast.error(getErrorMessage(error));
    refresh();
  };

  // Toda edição envia a versão conhecida (expectedUpdatedAt) para detectar conflitos.
  const patch = useMutation({
    mutationFn: (changes: UpdateTaskInput) => tasksApi.update(workspace.id, task.id, { ...changes, expectedUpdatedAt: task.updatedAt }),
    onSuccess: refresh,
    onError,
  });
  const action = useMutation({ mutationFn: (fn: () => Promise<unknown>) => fn(), onSuccess: refresh, onError });

  const assignees = members.filter((m) => task.assigneeIds.includes(m.id));
  const viewerUsers = members.filter((m) => viewers.includes(m.id));
  const project = projects.find((p) => p.id === task.projectId);
  const projectTasks = useQuery({
    queryKey: taskKeys.list(workspace.id, { projectId: task.projectId }),
    queryFn: () => tasksApi.list(workspace.id, { projectId: task.projectId }),
    enabled: editable,
  });
  const activity = useQuery({ queryKey: ["tasks", workspace.id, "activity", task.id], queryFn: () => tasksApi.activity(workspace.id, task.id) });

  const saveTitle = () => {
    const t = title.trim();
    if (t && t !== task.title) patch.mutate({ title: t });
    else setTitle(task.title);
  };

  return (
    <>
      <header className="space-y-3 border-b px-5 pb-4 pt-5 sm:px-6">
        <div className="flex items-center gap-2 pr-8 text-xs text-muted-foreground">
          {project && (
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded" style={{ background: project.color }} aria-hidden /> {project.name}
            </span>
          )}
          {task.parentId && <span>· Subtarefa</span>}
          {viewerUsers.length > 0 && (
            <span className="ml-auto flex items-center gap-1.5" title="Vendo agora">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" aria-hidden />
              <AvatarStack users={viewerUsers} />
            </span>
          )}
        </div>
        {task.deletedAt && (
          <div className="flex items-center justify-between rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            Esta tarefa está na lixeira.
            <Button size="sm" variant="outline" onClick={() => action.mutate(() => tasksApi.restore(workspace.id, task.id))}>
              <RotateCcw /> Restaurar
            </Button>
          </div>
        )}
        <SheetTitle asChild>
          <textarea
            value={title}
            disabled={!editable}
            maxLength={120}
            rows={1}
            onChange={(e) => setTitle(e.target.value.replace(/\n/g, ""))}
            onBlur={saveTitle}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), e.currentTarget.blur())}
            className="w-full resize-none bg-transparent font-display text-2xl font-bold leading-tight outline-none focus-visible:rounded-md focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default"
            aria-label="Título da tarefa"
          />
        </SheetTitle>
        <SheetDescription className="sr-only">Detalhes, checklist, subtarefas, comentários e histórico da tarefa.</SheetDescription>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={task.status} disabled={!editable} onValueChange={(v) => patch.mutate({ status: v as TaskDetail["status"] })}>
            <SelectTrigger className="h-8 w-auto gap-2" aria-label="Status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TASK_STATUSES.map((s) => {
                const Icon = STATUS_META[s].icon;
                return (
                  <SelectItem key={s} value={s}>
                    <span className="flex items-center gap-2">
                      <Icon className={cn("h-4 w-4", STATUS_META[s].className)} aria-hidden /> {STATUS_LABELS[s]}
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">{task.progress}% concluído</span>
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={task.progress} aria-valuemin={0} aria-valuemax={100} aria-label="Progresso">
            <div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${task.progress}%` }} />
          </div>
          <div className="ml-auto flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5"
              onClick={() => action.mutate(() => tasksApi.follow(workspace.id, task.id, !following))}
              aria-pressed={following}
            >
              {following ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />} {following ? "Deixar de seguir" : "Seguir"}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Mais ações">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onSelect={() => void navigator.clipboard?.writeText(window.location.href).then(() => toast.success("Link copiado"))}
                >
                  <Link2 className="mr-2 h-4 w-4" /> Copiar link
                </DropdownMenuItem>
                {can(workspace.role, "tasks.create") && !task.deletedAt && (
                  <DropdownMenuItem onSelect={() => action.mutate(() => tasksApi.duplicate(workspace.id, task.id).then(() => toast.success("Tarefa duplicada")))}>
                    <Copy className="mr-2 h-4 w-4" /> Duplicar
                  </DropdownMenuItem>
                )}
                {editable && (
                  <DropdownMenuItem onSelect={() => action.mutate(() => tasksApi.archive(workspace.id, task.id, !task.archivedAt))}>
                    {task.archivedAt ? <ArchiveRestore className="mr-2 h-4 w-4" /> : <Archive className="mr-2 h-4 w-4" />}
                    {task.archivedAt ? "Desarquivar" : "Arquivar"}
                  </DropdownMenuItem>
                )}
                {can(workspace.role, "tasks.delete") && !task.deletedAt && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive"
                      onSelect={() =>
                        action.mutate(() =>
                          tasksApi.remove(workspace.id, task.id).then(() => {
                            close();
                            toast.success("Tarefa movida para a lixeira");
                          }),
                        )
                      }
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Mover para a lixeira
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <div className="scrollbar-thin flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:px-6">
        {patch.isError && !(patch.error instanceof ApiError && patch.error.code === "EDIT_CONFLICT") && <InlineError>{getErrorMessage(patch.error)}</InlineError>}

        <div className="space-y-2.5">
          <Row icon={Flag} label="Prioridade">
            <Select value={task.priority} disabled={!editable} onValueChange={(v) => patch.mutate({ priority: v as TaskDetail["priority"] })}>
              <SelectTrigger className="h-8 w-40" aria-label="Prioridade">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TASK_PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {PRIORITY_LABELS[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Row>
          <Row icon={CheckSquare} label="Responsáveis">
            <MemberPicker members={members} value={task.assigneeIds} disabled={!editable} onChange={(ids) => patch.mutate({ assigneeIds: ids })} />
          </Row>
          <Row icon={CalendarClock} label="Datas">
            <div className="flex flex-wrap items-center gap-1.5">
              <Input type="date" aria-label="Início" className="h-8 w-[9.5rem]" disabled={!editable} defaultValue={task.startDate ?? ""} key={`s-${task.startDate}`} onBlur={(e) => e.target.value !== (task.startDate ?? "") && patch.mutate({ startDate: e.target.value || null })} />
              <span className="text-muted-foreground">→</span>
              <Input type="date" aria-label="Prazo" className="h-8 w-[9.5rem]" disabled={!editable} defaultValue={task.dueDate ?? ""} key={`d-${task.dueDate}`} onBlur={(e) => e.target.value !== (task.dueDate ?? "") && patch.mutate({ dueDate: e.target.value || null })} />
              <Input type="time" aria-label="Hora do prazo" className="h-8 w-28" disabled={!editable || !task.dueDate} defaultValue={task.dueTime ?? ""} key={`t-${task.dueTime}`} onBlur={(e) => e.target.value !== (task.dueTime ?? "") && patch.mutate({ dueTime: e.target.value || null })} />
            </div>
          </Row>
          <Row icon={Timer} label="Estimativa">
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                step={15}
                aria-label="Estimativa em minutos"
                className="h-8 w-28"
                disabled={!editable}
                defaultValue={task.estimateMinutes ?? ""}
                key={`e-${task.estimateMinutes}`}
                onBlur={(e) => {
                  const v = e.target.value === "" ? null : Math.max(0, Math.round(Number(e.target.value)));
                  if (v !== task.estimateMinutes) patch.mutate({ estimateMinutes: v });
                }}
              />
              <span className="text-xs text-muted-foreground">minutos</span>
            </div>
          </Row>
          <Row icon={Repeat} label="Recorrência">
            <Select value={task.recurrence ?? "none"} disabled={!editable || Boolean(task.parentId)} onValueChange={(v) => patch.mutate({ recurrence: v === "none" ? null : (v as TaskDetail["recurrence"]) })}>
              <SelectTrigger className="h-8 w-40" aria-label="Recorrência">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Não se repete</SelectItem>
                {RECURRENCES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {RECURRENCE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Row>
          <Row icon={ListTree} label="Etiquetas">
            <LabelPicker
              labels={labels}
              value={task.labelIds}
              disabled={!editable}
              onChange={(ids) => patch.mutate({ labelIds: ids })}
              onCreate={
                can(workspace.role, "labels.manage")
                  ? async (name) => {
                      const label = await workspacesApi.createLabel(workspace.id, { name, color: "#6D5DFC" });
                      void qc.invalidateQueries({ queryKey: wsKeys.labels(workspace.id) });
                      return label;
                    }
                  : undefined
              }
            />
          </Row>
          {!task.parentId && projects.length > 1 && can(workspace.role, "tasks.edit") && (
            <Row icon={GitBranch} label="Projeto">
              <Select value={task.projectId} disabled={!editable} onValueChange={(v) => patch.mutate({ projectId: v })}>
                <SelectTrigger className="h-8 w-56" aria-label="Projeto">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Row>
          )}
        </div>

        <section aria-labelledby="desc-h" className="space-y-2">
          <h3 id="desc-h" className="text-sm font-semibold">
            Descrição
          </h3>
          {editingDesc ? (
            <div className="space-y-2">
              <MarkdownEditor value={description} onChange={setDescription} maxLength={20000} autoFocus placeholder="Contexto, critérios de aceite, links…" />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setEditingDesc(false)}>
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  disabled={patch.isPending}
                  onClick={() => {
                    if (description !== (task.description ?? "")) patch.mutate({ description: description || null });
                    setEditingDesc(false);
                  }}
                >
                  Salvar
                </Button>
              </div>
            </div>
          ) : (
            <button
              disabled={!editable}
              onClick={() => setEditingDesc(true)}
              className="block w-full rounded-lg border border-transparent px-3 py-2 text-left transition-colors hover:border-border hover:bg-muted/40 disabled:pointer-events-none"
            >
              {task.description ? <MarkdownView value={task.description} /> : <span className="text-sm text-muted-foreground">Adicionar descrição…</span>}
            </button>
          )}
        </section>

        <section aria-labelledby="check-h" className="space-y-2">
          <h3 id="check-h" className="flex items-center gap-2 text-sm font-semibold">
            Checklist
            {task.checklist.length > 0 && (
              <span className="text-xs font-normal text-muted-foreground">
                {task.checklist.filter((i) => i.done).length}/{task.checklist.length}
              </span>
            )}
          </h3>
          <ul className="space-y-1">
            {task.checklist.map((item) => (
              <li key={item.id} className="group flex items-center gap-2.5 rounded-md px-1 py-1 hover:bg-muted/50">
                <Checkbox
                  checked={item.done}
                  disabled={!editable}
                  onCheckedChange={(v) => action.mutate(() => tasksApi.updateChecklistItem(workspace.id, task.id, item.id, { done: v === true }))}
                  aria-label={item.content}
                />
                <span className={cn("flex-1 text-sm", item.done && "text-muted-foreground line-through")}>{item.content}</span>
                {editable && (
                  <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 focus-visible:opacity-100" aria-label={`Remover ${item.content}`} onClick={() => action.mutate(() => tasksApi.removeChecklistItem(workspace.id, task.id, item.id))}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
          {editable && (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!newItem.trim()) return;
                const content = newItem.trim();
                setNewItem("");
                action.mutate(() => tasksApi.addChecklistItem(workspace.id, task.id, content));
              }}
            >
              <Input value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder="Adicionar item…" maxLength={300} className="h-8" aria-label="Novo item do checklist" />
              <Button type="submit" size="sm" variant="outline" className="h-8" disabled={!newItem.trim()}>
                <Plus /> Adicionar
              </Button>
            </form>
          )}
        </section>

        {!task.parentId && (
          <section aria-labelledby="sub-h" className="space-y-2">
            <h3 id="sub-h" className="text-sm font-semibold">
              Subtarefas
            </h3>
            <ul className="space-y-1">
              {task.subtasks.map((s) => (
                <li key={s.id} className="flex items-center gap-2.5 rounded-md px-1 py-1 hover:bg-muted/50">
                  <Checkbox
                    checked={s.status === "done"}
                    disabled={!editable}
                    onCheckedChange={(v) => action.mutate(() => tasksApi.update(workspace.id, s.id, { status: v === true ? "done" : "todo" }))}
                    aria-label={s.title}
                  />
                  <span className={cn("flex-1 text-sm", s.status === "done" && "text-muted-foreground line-through")}>{s.title}</span>
                  <AvatarStack users={members.filter((m) => s.assigneeIds.includes(m.id))} max={2} />
                </li>
              ))}
            </ul>
            {can(workspace.role, "tasks.create") && !task.deletedAt && (
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newSubtask.trim()) return;
                  const title = newSubtask.trim();
                  setNewSubtask("");
                  action.mutate(() => tasksApi.create(workspace.id, { title, parentId: task.id }));
                }}
              >
                <Input value={newSubtask} onChange={(e) => setNewSubtask(e.target.value)} placeholder="Adicionar subtarefa…" maxLength={120} className="h-8" aria-label="Nova subtarefa" />
                <Button type="submit" size="sm" variant="outline" className="h-8" disabled={!newSubtask.trim()}>
                  <Plus /> Adicionar
                </Button>
              </form>
            )}
          </section>
        )}

        <TaskTimeSection task={task} workspace={workspace} />

        {user && (
          <section aria-labelledby="files-h" className="space-y-2">
            <h3 id="files-h" className="text-sm font-semibold">Anexos</h3>
            <AttachmentsPanel workspaceId={workspace.id} projectId={task.projectId} taskId={task.id} role={task.deletedAt ? "viewer" : workspace.role} userId={user.id} compact />
          </section>
        )}

        <section aria-labelledby="dep-h" className="space-y-2">
          <h3 id="dep-h" className="text-sm font-semibold">
            Depende de
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {task.dependencyIds.map((id) => {
              const dep = projectTasks.data?.find((t) => t.id === id);
              return (
                <span key={id} className="flex items-center gap-1 rounded-md border bg-muted/40 py-0.5 pl-2 pr-1 text-xs">
                  {dep ? dep.title : "Tarefa"} {dep?.status === "done" && "✓"}
                  {editable && (
                    <button className="rounded p-0.5 hover:bg-accent" aria-label="Remover dependência" onClick={() => action.mutate(() => tasksApi.removeDependency(workspace.id, task.id, id))}>
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </span>
              );
            })}
            {editable && (
              <Select value="" onValueChange={(v) => action.mutate(() => tasksApi.addDependency(workspace.id, task.id, v))}>
                <SelectTrigger className="h-7 w-48 text-xs" aria-label="Adicionar dependência">
                  <SelectValue placeholder="+ Adicionar dependência" />
                </SelectTrigger>
                <SelectContent>
                  {(projectTasks.data ?? [])
                    .filter((t) => t.id !== task.id && !task.dependencyIds.includes(t.id))
                    .map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.title}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            )}
            {!task.dependencyIds.length && !editable && <span className="text-sm text-muted-foreground">Nenhuma.</span>}
          </div>
        </section>

        <Tabs defaultValue="comments">
          <TabsList>
            <TabsTrigger value="comments">
              <MessageSquare /> Comentários {task.commentCount > 0 && `(${task.commentCount})`}
            </TabsTrigger>
            <TabsTrigger value="history">
              <History /> Histórico
            </TabsTrigger>
          </TabsList>
          <TabsContent value="comments">
            <TaskComments workspaceId={workspace.id} taskId={task.id} members={members} userId={user!.id} role={workspace.role} />
          </TabsContent>
          <TabsContent value="history">
            <ol className="space-y-3 border-l pl-4">
              {(activity.data?.items ?? []).map((a) => (
                <li key={a.id} className="relative text-sm">
                  <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-primary" aria-hidden />
                  <span className="font-medium">{a.actor?.name ?? "Sistema"}</span> {ACTIVITY_LABELS[a.action] ?? a.action}
                  {Array.isArray(a.data.changes) && a.data.changes.length > 0 && (
                    <span className="text-muted-foreground"> ({(a.data.changes as string[]).map((c) => FIELD_LABELS[c] ?? c).join(", ")})</span>
                  )}
                  <time className="block text-xs text-muted-foreground" dateTime={a.createdAt} title={formatDateTime(a.createdAt)}>
                    {relativeTime(a.createdAt)}
                  </time>
                </li>
              ))}
              {activity.data && !activity.data.items.length && <li className="text-sm text-muted-foreground">Sem histórico.</li>}
            </ol>
          </TabsContent>
        </Tabs>

        <p className="text-xs text-muted-foreground">
          Criada {relativeTime(task.createdAt)} · atualizada {relativeTime(task.updatedAt)}
          {assignees.length > 0 && ` · ${assignees.length} responsável(is)`}
        </p>
      </div>
    </>
  );
}

/** Painel lateral da tarefa, aberto por `?tarefa=<id>` em qualquer página do app. */
export function TaskDetailSheet({ workspace }: { workspace: Workspace }) {
  const [params, setParams] = useSearchParams();
  const taskId = params.get("tarefa");
  const close = () =>
    setParams(
      (p) => {
        p.delete("tarefa");
        return p;
      },
      { replace: true },
    );
  const detail = useQuery({
    queryKey: taskKeys.detail(workspace.id, taskId ?? ""),
    queryFn: () => tasksApi.get(workspace.id, taskId!),
    enabled: Boolean(taskId && /^[0-9a-f-]{36}$/i.test(taskId)),
  });

  return (
    <Sheet open={Boolean(taskId)} onOpenChange={(open) => !open && close()}>
      <SheetContent aria-describedby={undefined}>
        {detail.isPending ? (
          <div className="space-y-4 p-6">
            <SheetTitle className="sr-only">Carregando tarefa</SheetTitle>
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : detail.isError ? (
          <div className="space-y-3 p-6">
            <SheetTitle>Tarefa indisponível</SheetTitle>
            <InlineError>{getErrorMessage(detail.error)}</InlineError>
            <Button variant="outline" onClick={close}>
              Fechar
            </Button>
          </div>
        ) : (
          <DetailBody task={detail.data} workspace={workspace} close={close} />
        )}
      </SheetContent>
    </Sheet>
  );
}
