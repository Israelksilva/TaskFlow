import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PRIORITY_LABELS, TASK_PRIORITIES, type TaskPriority, type Workspace } from "@andamo/shared";
import { InlineError } from "@/components/feedback/InlineError";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMembers, useProjects } from "@/features/workspaces/hooks";
import { useAuth } from "@/features/auth/use-auth";
import { getErrorMessage } from "@/lib/api-client";
import { tasksApi } from "../api";

/** Criação rápida de tarefa a partir de qualquer tela (botão "+" do header, tecla N, Ctrl+K). */
export function QuickCreateDialog({
  open,
  onOpenChange,
  workspace,
  defaultProjectId,
  defaultDueDate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspace: Workspace;
  defaultProjectId?: string;
  defaultDueDate?: string;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuth();
  const projectsQuery = useProjects(workspace.id);
  const projects = useMemo(() => projectsQuery.data ?? [], [projectsQuery.data]);
  const members = useMembers(workspace.id).data ?? [];
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("media");
  const [dueDate, setDueDate] = useState("");
  const [assignee, setAssignee] = useState<string>("me");

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setPriority("media");
    setDueDate(defaultDueDate ?? "");
    setAssignee("me");
    setProjectId(defaultProjectId ?? projects.find((p) => p.isDefault)?.id ?? projects[0]?.id ?? "");
  }, [open, defaultProjectId, defaultDueDate, projects]);

  const create = useMutation({
    mutationFn: () =>
      tasksApi.create(workspace.id, {
        title,
        projectId,
        priority,
        dueDate: dueDate || null,
        assigneeIds: assignee === "none" ? [] : [assignee === "me" ? user!.id : assignee],
      }),
    onSuccess: (task) => {
      void qc.invalidateQueries({ queryKey: ["tasks", workspace.id] });
      void qc.invalidateQueries({ queryKey: ["workspaces", workspace.id] });
      onOpenChange(false);
      toast.success("Tarefa criada", {
        description: task.title,
        action: { label: "Abrir", onClick: () => navigate(`/app/w/${workspace.id}/projetos/${task.projectId}?tarefa=${task.id}`) },
      });
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !projectId || create.isPending) return;
    create.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova tarefa</DialogTitle>
          <DialogDescription>Crie rapidamente; os detalhes podem ser preenchidos depois.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="qc-title">Título</Label>
            <Input id="qc-title" autoFocus value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Revisar proposta comercial" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Projeto</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger aria-label="Projeto">
                  <SelectValue placeholder="Escolha um projeto" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Responsável</Label>
              <Select value={assignee} onValueChange={setAssignee}>
                <SelectTrigger aria-label="Responsável">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="me">Eu</SelectItem>
                  <SelectItem value="none">Ninguém</SelectItem>
                  {members
                    .filter((m) => m.id !== user?.id)
                    .map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Prioridade</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                <SelectTrigger aria-label="Prioridade">
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
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qc-due">Prazo</Label>
              <Input id="qc-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
          {create.isError && <InlineError>{getErrorMessage(create.error)}</InlineError>}
          {!projects.length && <p className="text-sm text-muted-foreground">Crie um projeto antes de adicionar tarefas.</p>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!title.trim() || !projectId || create.isPending}>
              {create.isPending && <Loader2 className="animate-spin" aria-hidden />} Criar tarefa
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
