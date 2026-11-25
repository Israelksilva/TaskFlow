import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { PartyPopper } from "lucide-react";
import { addDays, toISODate, type Task } from "@andamo/shared";
import { EmptyState } from "@/components/feedback/EmptyState";
import { InlineError } from "@/components/feedback/InlineError";
import { useCrumbs } from "@/components/layout/AppHeader";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCurrentWorkspace, useProjects, useWsMutation } from "@/features/workspaces/hooks";
import { getErrorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { tasksApi } from "../api";
import { taskKeys } from "../hooks";
import { DueDateBadge, PriorityBadge } from "../components/TaskBadges";

type Bucket = "overdue" | "today" | "week" | "later" | "none" | "done";
const BUCKETS: Record<Bucket, string> = {
  overdue: "Atrasadas",
  today: "Hoje",
  week: "Próximos 7 dias",
  later: "Mais tarde",
  none: "Sem prazo",
  done: "Concluídas recentemente",
};

function bucketOf(t: Task, today: string): Bucket {
  if (t.status === "done") return "done";
  if (!t.dueDate) return "none";
  if (t.dueDate < today) return "overdue";
  if (t.dueDate === today) return "today";
  if (t.dueDate <= addDays(today, 7)) return "week";
  return "later";
}

/** Tudo o que está atribuído a mim no workspace, em todos os projetos (inclui subtarefas). */
export default function MyTasksPage() {
  const ws = useCurrentWorkspace();
  const [, setParams] = useSearchParams();
  const [showDone, setShowDone] = useState(false);
  const projects = useProjects(ws.id).data ?? [];
  const projectMap = new Map(projects.map((p) => [p.id, p]));
  useCrumbs([{ label: ws.name, to: `/app/w/${ws.id}` }, { label: "Minhas tarefas" }]);
  const query = { assigneeId: "me", includeSubtasks: "true" } as const;
  const tasks = useQuery({
    queryKey: taskKeys.list(ws.id, query),
    queryFn: () => tasksApi.list(ws.id, query),
  });
  const toggle = useWsMutation((t: Task) => tasksApi.update(ws.id, t.id, { status: t.status === "done" ? "todo" : "done" }), {
    invalidate: [["tasks", ws.id]],
  });

  const today = toISODate();
  const grouped = useMemo(() => {
    const g = new Map<Bucket, Task[]>();
    for (const t of tasks.data ?? []) {
      const b = bucketOf(t, today);
      if (b === "done" && !showDone) continue;
      g.set(b, [...(g.get(b) ?? []), t]);
    }
    return (Object.keys(BUCKETS) as Bucket[]).filter((b) => g.get(b)?.length).map((b) => [b, g.get(b)!] as const);
  }, [tasks.data, today, showDone]);

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-6 lg:py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">Minhas tarefas</h1>
          <p className="mt-1 text-sm text-muted-foreground">Tudo atribuído a você em {ws.name}, organizado por prazo.</p>
        </div>
        <Tabs value={showDone ? "all" : "open"} onValueChange={(v) => setShowDone(v === "all")}>
          <TabsList>
            <TabsTrigger value="open">Abertas</TabsTrigger>
            <TabsTrigger value="all">Incluir concluídas</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {tasks.isError && <InlineError>{getErrorMessage(tasks.error)}</InlineError>}
      {tasks.isPending ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : grouped.length === 0 ? (
        <EmptyState icon={PartyPopper} title="Nada pendente com você" description="Quando alguém atribuir uma tarefa a você, ela aparece aqui." />
      ) : (
        grouped.map(([bucket, list]) => (
          <section key={bucket} aria-label={BUCKETS[bucket]} className="overflow-hidden rounded-xl border bg-card shadow-card">
            <header className={cn("flex items-center gap-2 border-b px-4 py-2.5 text-sm font-semibold", bucket === "overdue" && "text-destructive")}>
              {BUCKETS[bucket]} <span className="text-xs font-normal text-muted-foreground">{list.length}</span>
            </header>
            <ul className="divide-y">
              {list.map((t) => {
                const project = projectMap.get(t.projectId);
                return (
                  <li key={t.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent/40">
                    <Checkbox checked={t.status === "done"} onCheckedChange={() => toggle.mutate(t)} aria-label={t.status === "done" ? `Reabrir ${t.title}` : `Concluir ${t.title}`} />
                    <button
                      className="min-w-0 flex-1 text-left"
                      onClick={() =>
                        setParams((p) => {
                          p.set("tarefa", t.id);
                          return p;
                        })
                      }
                    >
                      <span className={cn("block truncate text-sm font-medium hover:text-primary", t.status === "done" && "text-muted-foreground line-through")}>{t.title}</span>
                      {project && (
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span className="h-2 w-2 rounded-sm" style={{ background: project.color }} aria-hidden /> {project.name}
                          {t.parentId && " · subtarefa"}
                        </span>
                      )}
                    </button>
                    <PriorityBadge priority={t.priority} />
                    <span className="hidden w-24 sm:block">
                      <DueDateBadge task={t} />
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
