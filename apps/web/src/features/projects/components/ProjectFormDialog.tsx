import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import {
  PRIORITY_LABELS,
  PROJECT_STATUS_LABELS,
  PROJECT_STATUSES,
  TASK_PRIORITIES,
  type Project,
  type ProjectStatus,
  type TaskPriority,
  type Workspace,
} from "@andamo/shared";
import { InlineError } from "@/components/feedback/InlineError";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { workspacesApi } from "@/features/workspaces/api";
import { useProjects, useWsMutation } from "@/features/workspaces/hooks";
import { getErrorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";

export const PROJECT_COLORS = ["#6D5DFC", "#A646F0", "#FF8A65", "#E5484D", "#F5A524", "#2BB673", "#0EA5E9", "#64748B"];

/** Criar ou editar projeto (nome, descrição, objetivo, cor, status, prioridade, datas, template). */
export function ProjectFormDialog({
  open,
  onOpenChange,
  workspace,
  project,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspace: Workspace;
  project?: Project | null;
}) {
  const navigate = useNavigate();
  const templates = useProjects(workspace.id, "templates").data ?? [];
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [goal, setGoal] = useState("");
  const [color, setColor] = useState(PROJECT_COLORS[0]);
  const [status, setStatus] = useState<ProjectStatus>("active");
  const [priority, setPriority] = useState<TaskPriority>("media");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [templateId, setTemplateId] = useState("none");
  const [isTemplate, setIsTemplate] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(project?.name ?? "");
    setDescription(project?.description ?? "");
    setGoal(project?.goal ?? "");
    setColor(project?.color ?? PROJECT_COLORS[0]);
    setStatus(project?.status ?? "active");
    setPriority(project?.priority ?? "media");
    setStartDate(project?.startDate ?? "");
    setDueDate(project?.dueDate ?? "");
    setIsTemplate(project?.isTemplate ?? false);
    setTemplateId("none");
  }, [open, project]);

  const payload = {
    name,
    description: description || null,
    goal: goal || null,
    color,
    status,
    priority,
    startDate: startDate || null,
    dueDate: dueDate || null,
    isTemplate,
  };
  const save = useWsMutation(
    () =>
      project
        ? workspacesApi.updateProject(workspace.id, project.id, payload)
        : workspacesApi.createProject(workspace.id, { ...payload, templateId: templateId === "none" ? undefined : templateId }),
    {
      invalidate: [["workspaces", workspace.id]],
      success: project ? "Projeto atualizado" : "Projeto criado",
      onSuccess: (p) => {
        onOpenChange(false);
        if (!project) navigate(`/app/w/${workspace.id}/projetos/${p.id}`);
      },
    },
  );

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (name.trim() && !save.isPending) save.mutate(undefined);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{project ? "Editar projeto" : "Novo projeto"}</DialogTitle>
          <DialogDescription>Projetos agrupam tarefas, prazos e pessoas em torno de um objetivo.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="pf-name">Nome</Label>
            <Input id="pf-name" autoFocus maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Lançamento do site" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pf-goal">Objetivo</Label>
            <Input id="pf-goal" maxLength={500} value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="O que define o sucesso deste projeto?" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pf-desc">Descrição</Label>
            <Textarea id="pf-desc" rows={3} maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium">Cor</legend>
            <div className="flex flex-wrap gap-2">
              {PROJECT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={`Cor ${c}`}
                  aria-pressed={color === c}
                  className={cn("h-7 w-7 rounded-lg ring-offset-2 ring-offset-background transition-transform hover:scale-110", color === c && "ring-2 ring-foreground")}
                  style={{ background: c }}
                />
              ))}
            </div>
          </fieldset>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as ProjectStatus)}>
                <SelectTrigger aria-label="Status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROJECT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {PROJECT_STATUS_LABELS[s]}
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
              <Label htmlFor="pf-start">Início</Label>
              <Input id="pf-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pf-due">Conclusão prevista</Label>
              <Input id="pf-due" type="date" value={dueDate} min={startDate || undefined} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
          {!project && templates.length > 0 && (
            <div className="space-y-1.5">
              <Label>Começar a partir de um template</Label>
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger aria-label="Template">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Projeto em branco</SelectItem>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isTemplate} onChange={(e) => setIsTemplate(e.target.checked)} className="h-4 w-4 accent-[hsl(var(--primary))]" />
            Usar como template (aparece na criação de novos projetos)
          </label>
          {save.isError && <InlineError>{getErrorMessage(save.error)}</InlineError>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!name.trim() || save.isPending}>
              {save.isPending && <Loader2 className="animate-spin" aria-hidden />} {project ? "Salvar" : "Criar projeto"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
