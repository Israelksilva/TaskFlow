import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Plus, Trash2 } from "lucide-react";
import {
  ACTION_LABELS,
  AUTOMATION_TRIGGERS,
  NOTIFY_TARGET_LABELS,
  NOTIFY_TARGETS,
  PRIORITY_LABELS,
  STATUS_LABELS,
  TASK_PRIORITIES,
  TASK_STATUSES,
  TRIGGER_LABELS,
  type Automation,
  type AutomationAction,
  type AutomationConditions,
  type AutomationTrigger,
  type NotifyTarget,
  type TaskPriority,
  type TaskStatus,
  type Workspace,
} from "@andamo/shared";
import { InlineError } from "@/components/feedback/InlineError";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { workspacesApi } from "@/features/workspaces/api";
import { useLabels, useMembers, useProjects, useWsMutation, wsKeys } from "@/features/workspaces/hooks";
import { getErrorMessage } from "@/lib/api-client";

export interface AutomationDraft {
  name: string;
  projectId: string | null;
  trigger: AutomationTrigger;
  conditions: AutomationConditions;
  actions: AutomationAction[];
}

const ALL = "__all__";
const NONE = "__none__";

/** Ação nova com valores padrão coerentes para cada tipo. */
function defaultAction(type: AutomationAction["type"]): AutomationAction | null {
  switch (type) {
    case "notify":
      return { type, target: "assignees" };
    case "set_priority":
      return { type, priority: "alta" };
    case "set_due_in_days":
      return { type, days: 3 };
    case "complete_parent":
      return { type };
    default:
      return null; // exigem escolha (pessoa, coluna, etiqueta)
  }
}

function ActionEditor({
  action,
  onChange,
  onRemove,
  members,
  labels,
  columns,
}: {
  action: AutomationAction;
  onChange: (a: AutomationAction) => void;
  onRemove: () => void;
  members: Array<{ id: string; name: string }>;
  labels: Array<{ id: string; name: string }>;
  columns: Array<{ id: string; name: string }>;
}) {
  const pick = (value: string, items: Array<{ id: string; name: string }>, onPick: (id: string) => void, placeholder: string, label: string) => (
    <Select value={value || undefined} onValueChange={onPick}>
      <SelectTrigger className="h-8 w-56" aria-label={label}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {items.map((i) => (
          <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-2">
      <span className="text-sm font-medium">{ACTION_LABELS[action.type]}</span>
      {action.type === "notify" && (
        <>
          <Select value={action.target} onValueChange={(v) => onChange({ ...action, target: v as NotifyTarget, userId: v === "user" ? action.userId : undefined })}>
            <SelectTrigger className="h-8 w-56" aria-label="Quem notificar"><SelectValue /></SelectTrigger>
            <SelectContent>
              {NOTIFY_TARGETS.map((t) => <SelectItem key={t} value={t}>{NOTIFY_TARGET_LABELS[t]}</SelectItem>)}
            </SelectContent>
          </Select>
          {action.target === "user" && pick(action.userId ?? "", members, (userId) => onChange({ ...action, userId }), "Escolha a pessoa", "Pessoa")}
          <Input
            className="h-8 min-w-48 flex-1"
            placeholder="Mensagem (opcional)"
            maxLength={200}
            value={action.message ?? ""}
            onChange={(e) => onChange({ ...action, message: e.target.value })}
            aria-label="Mensagem da notificação"
          />
        </>
      )}
      {action.type === "assign" && pick(action.userId, members, (userId) => onChange({ ...action, userId }), "Escolha a pessoa", "Pessoa")}
      {action.type === "set_priority" && (
        <Select value={action.priority} onValueChange={(v) => onChange({ ...action, priority: v as TaskPriority })}>
          <SelectTrigger className="h-8 w-40" aria-label="Prioridade"><SelectValue /></SelectTrigger>
          <SelectContent>{TASK_PRIORITIES.map((p) => <SelectItem key={p} value={p}>{PRIORITY_LABELS[p]}</SelectItem>)}</SelectContent>
        </Select>
      )}
      {action.type === "move_to_column" && pick(action.columnId, columns, (columnId) => onChange({ ...action, columnId }), columns.length ? "Escolha a coluna" : "Escolha um projeto antes", "Coluna")}
      {action.type === "add_label" && pick(action.labelId, labels, (labelId) => onChange({ ...action, labelId }), "Escolha a etiqueta", "Etiqueta")}
      {action.type === "set_due_in_days" && (
        <Input type="number" min={0} max={365} className="h-8 w-24" value={action.days} onChange={(e) => onChange({ ...action, days: Math.max(0, Math.min(365, Number(e.target.value) || 0)) })} aria-label="Dias" />
      )}
      <Button type="button" variant="ghost" size="icon" className="ml-auto h-8 w-8" onClick={onRemove} aria-label="Remover ação">
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function AutomationDialog({
  open,
  onOpenChange,
  workspace,
  automation,
  draft,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspace: Workspace;
  automation: Automation | null;
  /** Modelo escolhido na galeria (pré-preenche a criação). */
  draft: AutomationDraft | null;
}) {
  const projects = useProjects(workspace.id).data ?? [];
  const members = useMembers(workspace.id).data ?? [];
  const labels = useLabels(workspace.id).data ?? [];
  const [form, setForm] = useState<AutomationDraft>({ name: "", projectId: null, trigger: "task.created", conditions: {}, actions: [] });
  const [pendingType, setPendingType] = useState<AutomationAction["type"] | "">("");

  useEffect(() => {
    if (!open) return;
    setForm(
      automation
        ? { name: automation.name, projectId: automation.projectId, trigger: automation.trigger, conditions: automation.conditions, actions: automation.actions }
        : (draft ?? { name: "", projectId: null, trigger: "task.created", conditions: {}, actions: [] }),
    );
    setPendingType("");
  }, [open, automation, draft]);

  const columns = useQuery({
    queryKey: wsKeys.columns(workspace.id, form.projectId ?? ""),
    queryFn: () => workspacesApi.columns(workspace.id, form.projectId!),
    enabled: Boolean(form.projectId),
  }).data ?? [];

  const save = useWsMutation(
    () =>
      automation
        ? workspacesApi.updateAutomation(workspace.id, automation.id, form)
        : workspacesApi.createAutomation(workspace.id, { ...form, enabled: true }),
    {
      invalidate: [["workspaces", workspace.id, "automations"]],
      success: automation ? "Automação atualizada" : "Automação criada",
      onSuccess: () => onOpenChange(false),
    },
  );

  const set = <K extends keyof AutomationDraft>(key: K, value: AutomationDraft[K]) => setForm((f) => ({ ...f, [key]: value }));
  const setCond = (patch: Partial<AutomationConditions>) => {
    const next = { ...form.conditions, ...patch };
    for (const k of Object.keys(next) as Array<keyof AutomationConditions>) {
      const v = next[k];
      if (v === undefined || (Array.isArray(v) && !v.length)) delete next[k];
    }
    set("conditions", next);
  };
  const addAction = (type: AutomationAction["type"]) => {
    const a = defaultAction(type);
    // Tipos que exigem uma escolha entram "incompletos" e o editor pede o valor.
    set("actions", [...form.actions, a ?? ({ type } as AutomationAction)]);
    setPendingType("");
  };
  const onlyNotify = form.trigger === "project.completed";
  const incomplete = form.actions.some(
    (a) => (a.type === "assign" && !a.userId) || (a.type === "move_to_column" && !a.columnId) || (a.type === "add_label" && !a.labelId) || (a.type === "notify" && a.target === "user" && !a.userId),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{automation ? "Editar automação" : "Nova automação"}</DialogTitle>
          <DialogDescription>Quando o gatilho acontecer e as condições forem atendidas, o Andamo executa as ações.</DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="au-name">Nome</Label>
              <Input id="au-name" maxLength={80} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Ex.: Avisar gestão ao concluir" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label>Vale para</Label>
              <Select
                value={form.projectId ?? ALL}
                onValueChange={(v) => {
                  setForm((f) => ({
                    ...f,
                    projectId: v === ALL ? null : v,
                    // Coluna depende do projeto: limpa referências do projeto anterior.
                    conditions: { ...f.conditions, toColumnId: undefined },
                    actions: f.actions.filter((a) => a.type !== "move_to_column"),
                  }));
                }}
              >
                <SelectTrigger aria-label="Projeto"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todos os projetos</SelectItem>
                  {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <fieldset className="space-y-1.5">
            <legend className="text-sm font-semibold">1. Gatilho</legend>
            <Select value={form.trigger} onValueChange={(v) => setForm((f) => ({ ...f, trigger: v as AutomationTrigger, conditions: {}, actions: v === "project.completed" ? f.actions.filter((a) => a.type === "notify") : f.actions }))}>
              <SelectTrigger aria-label="Gatilho"><SelectValue /></SelectTrigger>
              <SelectContent>{AUTOMATION_TRIGGERS.map((t) => <SelectItem key={t} value={t}>{TRIGGER_LABELS[t]}</SelectItem>)}</SelectContent>
            </Select>
          </fieldset>

          {!onlyNotify && (
            <fieldset className="space-y-3">
              <legend className="text-sm font-semibold">2. Condições (opcional)</legend>
              {form.trigger === "task.status_changed" && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="w-36 text-muted-foreground">Novo status</span>
                  <Select value={form.conditions.toStatus ?? NONE} onValueChange={(v) => setCond({ toStatus: v === NONE ? undefined : (v as TaskStatus) })}>
                    <SelectTrigger className="h-8 w-48" aria-label="Novo status"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Qualquer</SelectItem>
                      {TASK_STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {form.trigger === "task.moved" && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="w-36 text-muted-foreground">Coluna de destino</span>
                  <Select value={form.conditions.toColumnId ?? NONE} onValueChange={(v) => setCond({ toColumnId: v === NONE ? undefined : v })} disabled={!form.projectId}>
                    <SelectTrigger className="h-8 w-56" aria-label="Coluna de destino"><SelectValue placeholder="Escolha um projeto" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Qualquer coluna</SelectItem>
                      {columns.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="w-36 text-muted-foreground">Prioridade</span>
                {TASK_PRIORITIES.map((p) => (
                  <label key={p} className="flex items-center gap-1.5">
                    <Checkbox
                      checked={form.conditions.priorities?.includes(p) ?? false}
                      onCheckedChange={(v) => {
                        const cur = form.conditions.priorities ?? [];
                        setCond({ priorities: v ? [...cur, p] : cur.filter((x) => x !== p) });
                      }}
                    />
                    {PRIORITY_LABELS[p]}
                  </label>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="w-36 text-muted-foreground">Com a etiqueta</span>
                <Select value={form.conditions.labelId ?? NONE} onValueChange={(v) => setCond({ labelId: v === NONE ? undefined : v })}>
                  <SelectTrigger className="h-8 w-48" aria-label="Etiqueta"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Qualquer</SelectItem>
                    {labels.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="w-36 text-muted-foreground">Atribuída a</span>
                <Select value={form.conditions.assigneeId ?? NONE} onValueChange={(v) => setCond({ assigneeId: v === NONE ? undefined : v })}>
                  <SelectTrigger className="h-8 w-48" aria-label="Responsável"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Qualquer pessoa</SelectItem>
                    {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </fieldset>
          )}

          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold">{onlyNotify ? "2" : "3"}. Ações</legend>
            {form.actions.map((a, i) => (
              <ActionEditor
                key={i}
                action={a}
                members={members}
                labels={labels}
                columns={columns}
                onChange={(next) => set("actions", form.actions.map((x, j) => (j === i ? next : x)))}
                onRemove={() => set("actions", form.actions.filter((_, j) => j !== i))}
              />
            ))}
            {form.actions.length < 5 && (
              <div className="flex items-center gap-2">
                <Select value={pendingType || undefined} onValueChange={(v) => addAction(v as AutomationAction["type"])}>
                  <SelectTrigger className="h-8 w-64" aria-label="Adicionar ação">
                    <span className="flex items-center gap-1.5 text-sm"><Plus className="h-4 w-4" /> Adicionar ação</span>
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(ACTION_LABELS) as Array<AutomationAction["type"]>)
                      .filter((t) => !onlyNotify || t === "notify")
                      .filter((t) => t !== "move_to_column" || form.projectId)
                      .filter((t) => t !== "complete_parent" || form.trigger === "subtasks.completed" || form.trigger === "task.completed")
                      .map((t) => <SelectItem key={t} value={t}>{ACTION_LABELS[t]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </fieldset>

          {save.isError && <InlineError>{getErrorMessage(save.error)}</InlineError>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={form.name.trim().length < 2 || !form.actions.length || incomplete || save.isPending} onClick={() => save.mutate(undefined)}>
            {save.isPending && <Loader2 className="animate-spin" />} {automation ? "Salvar" : "Criar automação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
