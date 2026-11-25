import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, CircleDot, FolderKanban, LayoutGrid, ListTodo, Loader2, Settings2, Timer } from "lucide-react";
import type { DashboardData } from "@andamo/shared";
import { EmptyState } from "@/components/feedback/EmptyState";
import { InlineError } from "@/components/feedback/InlineError";
import { UserAvatar } from "@/components/feedback/UserAvatar";
import { useCrumbs } from "@/components/layout/AppHeader";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/features/auth/use-auth";
import { workspacesApi } from "@/features/workspaces/api";
import { useCurrentWorkspace, useMembers, useProjects, wsKeys } from "@/features/workspaces/hooks";
import { getErrorMessage } from "@/lib/api-client";
import { describeDueDate, relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const WIDGETS = {
  chart: "Evolução (criadas × concluídas)",
  upcoming: "Próximos vencimentos",
  projects: "Progresso dos projetos",
  team: "Produtividade da equipe",
  activity: "Atividades recentes",
} as const;
type WidgetId = keyof typeof WIDGETS;
const WIDGET_KEY = "andamo:dashboard-widgets";

function loadWidgets(): WidgetId[] {
  try {
    const saved = JSON.parse(localStorage.getItem(WIDGET_KEY) ?? "null") as WidgetId[] | null;
    return saved?.filter((w) => w in WIDGETS) ?? (Object.keys(WIDGETS) as WidgetId[]);
  } catch {
    return Object.keys(WIDGETS) as WidgetId[];
  }
}

function greeting(date = new Date()) {
  const h = date.getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

function Kpi({ icon: Icon, label, value, tone, hint }: { icon: typeof ListTodo; label: string; value: number | string; tone: string; hint?: string }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-card transition-shadow hover:shadow-elevated">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className={cn("flex h-7 w-7 items-center justify-center rounded-lg", tone)}>
          <Icon className="h-4 w-4" aria-hidden />
        </span>
      </div>
      <p className="mt-2 font-display text-3xl font-extrabold tabular-nums tracking-tight">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Gráfico de barras agrupadas em SVG (sem dependências), acessível por tabela oculta. */
function SeriesChart({ series }: { series: DashboardData["series"] }) {
  const [hover, setHover] = useState<number | null>(null);
  // Períodos longos são agrupados por semana para manter a leitura.
  const data = useMemo(() => {
    if (series.length <= 14) return series.map((s) => ({ label: s.date.slice(8, 10) + "/" + s.date.slice(5, 7), ...s }));
    const weeks: Array<{ label: string; date: string; created: number; completed: number }> = [];
    for (let i = 0; i < series.length; i += 7) {
      const chunk = series.slice(i, i + 7);
      weeks.push({
        label: `${chunk[0].date.slice(8, 10)}/${chunk[0].date.slice(5, 7)}`,
        date: chunk[0].date,
        created: chunk.reduce((a, s) => a + s.created, 0),
        completed: chunk.reduce((a, s) => a + s.completed, 0),
      });
    }
    return weeks;
  }, [series]);
  const max = Math.max(1, ...data.flatMap((d) => [d.created, d.completed]));
  const W = 640;
  const H = 180;
  const slot = W / data.length;
  const bar = Math.min(14, slot / 3);

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H + 24}`} className="h-52 w-full" role="img" aria-label="Tarefas criadas e concluídas por período">
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line key={f} x1={0} x2={W} y1={H - H * f} y2={H - H * f} className="stroke-border" strokeDasharray="3 4" />
        ))}
        {data.map((d, i) => {
          const x = i * slot + slot / 2;
          const hc = (d.created / max) * (H - 8);
          const hd = (d.completed / max) * (H - 8);
          return (
            <g key={d.date} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={i * slot} y={0} width={slot} height={H} fill="transparent" />
              <rect x={x - bar - 1} y={H - hc} width={bar} height={hc} rx={3} className="fill-primary/35" />
              <rect x={x + 1} y={H - hd} width={bar} height={hd} rx={3} className="fill-primary" />
              {(data.length <= 14 || i % 2 === 0) && (
                <text x={x} y={H + 16} textAnchor="middle" className="fill-muted-foreground text-[10px]">
                  {d.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <div className="pointer-events-none absolute top-0 rounded-lg border bg-popover px-3 py-2 text-xs shadow-elevated" style={{ left: `min(${((hover + 0.5) / data.length) * 100}%, calc(100% - 140px))` }}>
          <p className="font-semibold">{data[hover].label}</p>
          <p>Criadas: {data[hover].created}</p>
          <p>Concluídas: {data[hover].completed}</p>
        </div>
      )}
      <div className="mt-1 flex gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-primary/35" /> Criadas</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-primary" /> Concluídas</span>
      </div>
      <table className="sr-only">
        <caption>Tarefas por período</caption>
        <thead><tr><th>Período</th><th>Criadas</th><th>Concluídas</th></tr></thead>
        <tbody>{data.map((d) => <tr key={d.date}><td>{d.label}</td><td>{d.created}</td><td>{d.completed}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

function Panel({ title, children, action, className }: { title: string; children: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-xl border bg-card p-5 shadow-card", className)} aria-label={title}>
      <header className="mb-4 flex items-center justify-between gap-2">
        <h2 className="font-display text-base font-bold">{title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}

export default function DashboardPage() {
  const ws = useCurrentWorkspace();
  const { user } = useAuth();
  useCrumbs([{ label: ws.name, to: `/app/w/${ws.id}` }, { label: "Visão geral" }]);
  const [period, setPeriod] = useState<"7d" | "30d" | "90d">("30d");
  const [projectId, setProjectId] = useState("all");
  const [assigneeId, setAssigneeId] = useState("all");
  const [widgets, setWidgets] = useState<WidgetId[]>(loadWidgets);
  const projects = useProjects(ws.id).data ?? [];
  const members = useMembers(ws.id).data ?? [];
  const base = `/app/w/${ws.id}`;

  const query = useQuery({
    queryKey: [...wsKeys.dashboard(ws.id), period, projectId, assigneeId],
    queryFn: () =>
      workspacesApi.dashboard(ws.id, {
        period,
        projectId: projectId === "all" ? undefined : projectId,
        assigneeId: assigneeId === "all" ? undefined : assigneeId,
      }),
    placeholderData: (prev) => prev,
  });
  const d = query.data;
  const show = (w: WidgetId) => widgets.includes(w);
  const toggleWidget = (w: WidgetId) => {
    const next = show(w) ? widgets.filter((x) => x !== w) : [...widgets, w];
    setWidgets(next);
    try {
      localStorage.setItem(WIDGET_KEY, JSON.stringify(next));
    } catch {
      /* sem armazenamento */
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:py-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">
            {greeting()}, {user?.name.split(" ")[0]} 👋
          </p>
          <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight">Visão geral</h1>
          <p className="mt-1 text-sm text-muted-foreground">O pulso do workspace {ws.name}, com dados em tempo real.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
            <SelectTrigger className="h-9 w-36" aria-label="Período">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="90d">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger className="h-9 w-44" aria-label="Projeto">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os projetos</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={assigneeId} onValueChange={setAssigneeId}>
            <SelectTrigger className="h-9 w-44" aria-label="Responsável">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as pessoas</SelectItem>
              {members.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon" className="h-9 w-9" aria-label="Personalizar widgets">
                <Settings2 className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64">
              <p className="mb-2 text-sm font-semibold">Widgets visíveis</p>
              {(Object.keys(WIDGETS) as WidgetId[]).map((w) => (
                <label key={w} className="flex items-center gap-2 py-1 text-sm">
                  <Checkbox checked={show(w)} onCheckedChange={() => toggleWidget(w)} /> {WIDGETS[w]}
                </label>
              ))}
            </PopoverContent>
          </Popover>
          {query.isFetching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Atualizando" />}
        </div>
      </div>

      {query.isError && !d && <InlineError>{getErrorMessage(query.error)}</InlineError>}

      {!d ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
          <Skeleton className="h-72 rounded-xl sm:col-span-2 lg:col-span-3" />
          <Skeleton className="h-72 rounded-xl sm:col-span-2" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Kpi icon={FolderKanban} label="Projetos ativos" value={d.totals.projects} tone="bg-primary/10 text-primary" />
            <Kpi icon={ListTodo} label="Tarefas" value={d.totals.tasks} tone="bg-muted text-foreground" hint={`${d.totals.todo} pendentes`} />
            <Kpi icon={Timer} label="Em andamento" value={d.totals.doing} tone="bg-primary/10 text-primary" />
            <Kpi icon={CheckCircle2} label="Concluídas" value={d.totals.done} tone="bg-success/10 text-success" hint={`${d.totals.completionRate}% de conclusão`} />
            <Kpi icon={AlertTriangle} label="Atrasadas" value={d.totals.overdue} tone="bg-destructive/10 text-destructive" />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to={`${base}/minhas-tarefas`}>
                <ListTodo /> Minhas tarefas
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to={`${base}/projetos`}>
                <LayoutGrid /> Projetos
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to={`${base}/calendario`}>
                <CircleDot /> Calendário
              </Link>
            </Button>
          </div>

          <div className="grid gap-4 lg:grid-cols-5">
            {show("chart") && (
              <Panel title={period === "7d" ? "Evolução diária" : "Evolução semanal"} className="lg:col-span-3">
                {d.totals.tasks === 0 ? <p className="text-sm text-muted-foreground">Crie tarefas para ver a evolução aqui.</p> : <SeriesChart series={d.series} />}
              </Panel>
            )}
            {show("upcoming") && (
              <Panel title="Próximos vencimentos" className="lg:col-span-2">
                {d.upcoming.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum prazo nos próximos 14 dias. 🎉</p>
                ) : (
                  <ul className="space-y-1">
                    {d.upcoming.map((t) => {
                      const overdue = t.dueDate! < new Date().toISOString().slice(0, 10);
                      return (
                        <li key={t.id}>
                          <Link to={`${base}/projetos/${t.projectId}?tarefa=${t.id}`} className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-accent">
                            <span className={cn("h-2 w-2 shrink-0 rounded-full", overdue ? "bg-destructive" : "bg-warning")} aria-hidden />
                            <span className="min-w-0 flex-1 truncate text-sm">{t.title}</span>
                            <span className={cn("shrink-0 text-xs", overdue ? "font-semibold text-destructive" : "text-muted-foreground")}>
                              {describeDueDate(t.dueDate!)}
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Panel>
            )}
            {show("projects") && (
              <Panel title="Progresso dos projetos" className="lg:col-span-2" action={<Link to={`${base}/projetos`} className="text-xs font-medium text-primary hover:underline">Ver todos</Link>}>
                {d.projects.length === 0 ? (
                  <EmptyState icon={FolderKanban} title="Sem projetos" className="py-6" />
                ) : (
                  <ul className="space-y-4">
                    {d.projects.map((p) => (
                      <li key={p.id}>
                        <Link to={`${base}/projetos/${p.id}`} className="group block">
                          <div className="mb-1.5 flex items-center justify-between text-sm">
                            <span className="flex min-w-0 items-center gap-2 font-medium group-hover:text-primary">
                              <span className="h-2.5 w-2.5 shrink-0 rounded" style={{ background: p.color }} aria-hidden />
                              <span className="truncate">{p.name}</span>
                            </span>
                            <span className="text-xs tabular-nums text-muted-foreground">
                              {p.doneCount}/{p.taskCount} · {p.progress}%
                            </span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={p.progress} aria-valuemin={0} aria-valuemax={100} aria-label={`Progresso de ${p.name}`}>
                            <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${p.progress}%`, background: p.color }} />
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            )}
            {show("team") && (
              <Panel title="Produtividade da equipe" className="lg:col-span-3">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-muted-foreground">
                        <th className="pb-2 font-medium">Pessoa</th>
                        <th className="pb-2 text-right font-medium">Abertas</th>
                        <th className="pb-2 text-right font-medium">Concluídas no período</th>
                        <th className="pb-2 text-right font-medium">Atrasadas</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {d.productivity.map((p) => (
                        <tr key={p.user.id}>
                          <td className="py-2">
                            <span className="flex items-center gap-2">
                              <UserAvatar user={p.user} className="h-6 w-6 ring-0" /> {p.user.name}
                              {p.user.id === user?.id && <span className="text-xs text-muted-foreground">(você)</span>}
                            </span>
                          </td>
                          <td className="py-2 text-right tabular-nums">{p.assigned}</td>
                          <td className="py-2 text-right font-semibold tabular-nums text-success">{p.completed}</td>
                          <td className={cn("py-2 text-right tabular-nums", p.overdue > 0 && "font-semibold text-destructive")}>{p.overdue}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>
            )}
            {show("activity") && (
              <Panel title="Atividades recentes" className="lg:col-span-5">
                {d.activity.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nada por aqui ainda.</p>
                ) : (
                  <ul className="grid gap-x-6 gap-y-3 md:grid-cols-2">
                    {d.activity.map((a) => (
                      <li key={a.id} className="flex items-start gap-3 text-sm">
                        {a.actor ? <UserAvatar user={a.actor} className="h-7 w-7 ring-0" /> : <span className="h-7 w-7 rounded-full bg-muted" />}
                        <div className="min-w-0">
                          <p className="truncate">
                            <span className="font-medium">{a.actor?.name ?? "Alguém"}</span> {activityText(a.action)}{" "}
                            <span className="font-medium">{String(a.data.title ?? a.data.name ?? "")}</span>
                          </p>
                          <time className="text-xs text-muted-foreground" dateTime={a.createdAt}>
                            {relativeTime(a.createdAt)}
                          </time>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function activityText(action: string): string {
  const map: Record<string, string> = {
    "task.created": "criou",
    "task.updated": "atualizou",
    "task.completed": "concluiu",
    "task.deleted": "excluiu",
    "task.restored": "restaurou",
    "task.archived": "arquivou",
    "comment.created": "comentou em",
    "project.created": "criou o projeto",
    "project.updated": "atualizou o projeto",
    "project.completed": "concluiu o projeto",
    "project.archived": "arquivou o projeto",
    "member.joined": "entrou no workspace",
    "team.created": "criou a equipe",
    "workspace.created": "criou o workspace",
  };
  return map[action] ?? action;
}

