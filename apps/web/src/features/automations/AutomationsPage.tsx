import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Bell, CheckCircle2, Clock3, ListChecks, Pencil, Plus, Repeat, Trash2, UserPlus, Workflow, Zap } from "lucide-react";
import {
  ACTION_LABELS,
  can,
  NOTIFY_TARGET_LABELS,
  PLANS,
  PRIORITY_LABELS,
  STATUS_LABELS,
  TRIGGER_LABELS,
  type Automation,
  type AutomationAction,
} from "@andamo/shared";
import { EmptyState } from "@/components/feedback/EmptyState";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { workspacesApi } from "@/features/workspaces/api";
import { useCurrentWorkspace, useLabels, useMembers, useProjects, useWsMutation } from "@/features/workspaces/hooks";
import { getErrorMessage } from "@/lib/api-client";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AutomationDialog, type AutomationDraft } from "./AutomationDialog";

/** Modelos prontos (exemplos do requisito R17). */
const TEMPLATES: Array<{ icon: typeof Bell; title: string; text: string; draft: AutomationDraft }> = [
  {
    icon: CheckCircle2,
    title: "Concluída → avisar gestão",
    text: "Gestores e administradores recebem aviso quando uma tarefa é concluída.",
    draft: { name: "Avisar gestão ao concluir", projectId: null, trigger: "task.completed", conditions: {}, actions: [{ type: "notify", target: "managers" }] },
  },
  {
    icon: AlertTriangle,
    title: "Atrasada → cobrar responsável",
    text: "Quem é responsável recebe um aviso quando a tarefa passa do prazo.",
    draft: { name: "Cobrar tarefas atrasadas", projectId: null, trigger: "task.overdue", conditions: {}, actions: [{ type: "notify", target: "assignees", message: "Tarefa atrasada" }] },
  },
  {
    icon: UserPlus,
    title: "Nova tarefa → atribuir",
    text: "Toda tarefa nova (ex.: urgente) já nasce com um responsável.",
    draft: { name: "Triagem de novas tarefas", projectId: null, trigger: "task.created", conditions: { priorities: ["urgente"] }, actions: [{ type: "assign", userId: "" } as AutomationAction] },
  },
  {
    icon: ListChecks,
    title: "Subtarefas prontas → concluir principal",
    text: "Quando a última subtarefa é concluída, a principal também é.",
    draft: { name: "Concluir tarefa principal", projectId: null, trigger: "subtasks.completed", conditions: {}, actions: [{ type: "complete_parent" }] },
  },
  {
    icon: Workflow,
    title: "Mudou de coluna → ajustar",
    text: "Ao entrar numa coluna (ex.: Revisão), define prioridade ou avisa alguém. O status já segue a categoria da coluna.",
    draft: { name: "Ao entrar em revisão", projectId: null, trigger: "task.moved", conditions: {}, actions: [{ type: "notify", target: "followers" }] },
  },
  {
    icon: Zap,
    title: "Projeto concluído → avisar equipe",
    text: "Responsáveis e dono do projeto recebem a notícia da conclusão.",
    draft: { name: "Celebrar projeto concluído", projectId: null, trigger: "project.completed", conditions: {}, actions: [{ type: "notify", target: "project_members", message: "Projeto concluído 🎉" }] },
  },
];

export default function AutomationsPage() {
  const ws = useCurrentWorkspace();
  const projects = useProjects(ws.id).data ?? [];
  const members = useMembers(ws.id).data ?? [];
  const labels = useLabels(ws.id).data ?? [];
  const [dialog, setDialog] = useState<{ open: boolean; automation: Automation | null; draft: AutomationDraft | null }>({ open: false, automation: null, draft: null });
  const [toDelete, setToDelete] = useState<Automation | null>(null);
  useCrumbs([{ label: ws.name, to: `/app/w/${ws.id}` }, { label: "Automações" }]);
  const canManage = can(ws.role, "automations.manage");
  const key = ["workspaces", ws.id, "automations"] as const;
  const list = useQuery({ queryKey: key, queryFn: () => workspacesApi.automations(ws.id) });
  const runs = useQuery({ queryKey: [...key, "runs"], queryFn: () => workspacesApi.automationRuns(ws.id), refetchInterval: 30_000 });
  const toggle = useWsMutation((a: Automation) => workspacesApi.updateAutomation(ws.id, a.id, { enabled: !a.enabled }), {
    invalidate: [key],
    success: (a) => (a.enabled ? "Automação ativada" : "Automação pausada"),
  });
  const remove = useWsMutation((a: Automation) => workspacesApi.deleteAutomation(ws.id, a.id), { invalidate: [key], success: "Automação excluída" });

  const limit = PLANS[ws.plan].limits.automations;
  const count = list.data?.length ?? 0;
  const atLimit = limit !== null && count >= limit;
  const name = (id: string | undefined, items: Array<{ id: string; name: string }>) => items.find((i) => i.id === id)?.name ?? "—";

  const describeAction = (a: AutomationAction) => {
    switch (a.type) {
      case "notify":
        return `Notificar ${a.target === "user" ? name(a.userId, members) : NOTIFY_TARGET_LABELS[a.target].toLowerCase()}`;
      case "assign":
        return `Atribuir a ${name(a.userId, members)}`;
      case "set_priority":
        return `Prioridade ${PRIORITY_LABELS[a.priority].toLowerCase()}`;
      case "add_label":
        return `Etiqueta ${name(a.labelId, labels)}`;
      case "set_due_in_days":
        return `Prazo em ${a.days} dia(s)`;
      default:
        return ACTION_LABELS[a.type];
    }
  };
  const describeConditions = (a: Automation) => {
    const c = a.conditions;
    const parts = [
      c.toStatus && `status ${STATUS_LABELS[c.toStatus].toLowerCase()}`,
      c.priorities?.length && `prioridade ${c.priorities.map((p) => PRIORITY_LABELS[p].toLowerCase()).join("/")}`,
      c.labelId && `etiqueta ${name(c.labelId, labels)}`,
      c.assigneeId && `de ${name(c.assigneeId, members)}`,
      c.toColumnId && "coluna específica",
    ].filter(Boolean);
    return parts.length ? `se ${parts.join(", ")}` : "sempre";
  };
  const openNew = (draft: AutomationDraft | null) => setDialog({ open: true, automation: null, draft });

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6 lg:py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">Automações</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Regras “quando… então…” que trabalham pela equipe. {limit === null ? "Ilimitadas no seu plano." : `${count} de ${limit} no plano ${PLANS[ws.plan].name}.`}
          </p>
        </div>
        {canManage && (
          <Button onClick={() => openNew(null)} disabled={atLimit} className="bg-brand text-white shadow-glow hover:brightness-110">
            <Plus /> Nova automação
          </Button>
        )}
      </div>
      {!canManage && <p className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">Somente gestores e administradores criam e editam automações. Você pode acompanhar o que está ativo.</p>}

      <Tabs defaultValue="rules">
        <TabsList>
          <TabsTrigger value="rules">Automações</TabsTrigger>
          <TabsTrigger value="history"><Clock3 /> Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="rules" className="space-y-6">
          {list.isError && <InlineError>{getErrorMessage(list.error)}</InlineError>}
          {list.isPending ? (
            <Skeleton className="h-40 rounded-xl" />
          ) : count === 0 ? (
            <EmptyState icon={Repeat} title="Nenhuma automação ainda" description="Comece por um dos modelos abaixo — dá para ajustar tudo antes de salvar." />
          ) : (
            <ul className="space-y-3">
              {list.data!.map((a) => (
                <li key={a.id} className={cn("rounded-xl border bg-card p-4 shadow-card", !a.enabled && "opacity-70")}>
                  <div className="flex flex-wrap items-start gap-3">
                    <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", a.enabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                      <Zap className="h-4 w-4" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{a.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {TRIGGER_LABELS[a.trigger]} {a.projectId ? `em ${name(a.projectId, projects)}` : "(todos os projetos)"}, {describeConditions(a)} → {a.actions.map(describeAction).join(" · ")}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {a.runCount} execução(ões){a.lastRunAt && ` · última ${relativeTime(a.lastRunAt)}`}
                        {a.createdBy && ` · criada por ${a.createdBy.name}`}
                      </p>
                      {a.lastError && (
                        <p className="mt-1 flex items-center gap-1 text-xs font-medium text-destructive">
                          <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> Última falha: {a.lastError}
                        </p>
                      )}
                    </div>
                    {canManage && (
                      <div className="flex items-center gap-1">
                        <Switch checked={a.enabled} onCheckedChange={() => toggle.mutate(a)} aria-label={a.enabled ? `Pausar ${a.name}` : `Ativar ${a.name}`} />
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDialog({ open: true, automation: a, draft: null })} aria-label={`Editar ${a.name}`}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setToDelete(a)} aria-label={`Excluir ${a.name}`}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {canManage && (
            <section aria-labelledby="tpl-h" className="space-y-3">
              <h2 id="tpl-h" className="font-display font-bold">Modelos</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.title}
                    disabled={atLimit}
                    onClick={() => openNew(t.draft)}
                    className="rounded-xl border bg-card p-4 text-left shadow-card transition-all hover:-translate-y-0.5 hover:border-primary/40 disabled:pointer-events-none disabled:opacity-50"
                  >
                    <t.icon className="h-5 w-5 text-primary" aria-hidden />
                    <p className="mt-2 text-sm font-semibold">{t.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{t.text}</p>
                  </button>
                ))}
              </div>
              {atLimit && <p className="text-xs text-muted-foreground">Limite do plano atingido: exclua uma automação para criar outra.</p>}
              <p className="text-xs text-muted-foreground">Tarefas recorrentes já criam a próxima ocorrência automaticamente ao serem concluídas. Para evitar loops, uma automação nunca reage às próprias mudanças e cadeias param após 3 automações.</p>
            </section>
          )}
        </TabsContent>

        <TabsContent value="history">
          {runs.isPending ? (
            <Skeleton className="h-40 rounded-xl" />
          ) : !runs.data?.length ? (
            <EmptyState icon={Clock3} title="Nenhuma execução ainda" description="As execuções aparecem aqui em até alguns segundos depois do evento." />
          ) : (
            <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-card">
              {runs.data.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-semibold",
                      r.status === "success" && "bg-success/15 text-success",
                      r.status === "failed" && "bg-destructive/15 text-destructive",
                      r.status === "skipped" && "bg-muted text-muted-foreground",
                    )}
                  >
                    {r.status === "success" ? "Executada" : r.status === "failed" ? "Falhou" : "Ignorada"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{r.automationName}{r.taskTitle && <span className="font-normal text-muted-foreground"> · {r.taskTitle}</span>}</p>
                    {r.detail && <p className="truncate text-xs text-muted-foreground">{r.detail}</p>}
                  </div>
                  <time className="text-xs text-muted-foreground" dateTime={r.createdAt}>{relativeTime(r.createdAt)}</time>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>

      <AutomationDialog open={dialog.open} onOpenChange={(open) => setDialog((d) => ({ ...d, open }))} workspace={ws} automation={dialog.automation} draft={dialog.draft} />
      <AlertDialog open={Boolean(toDelete)} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir “{toDelete?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>A automação para de funcionar e o histórico dela é apagado. Para só interromper, use o botão de pausar.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => toDelete && remove.mutate(toDelete)}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
