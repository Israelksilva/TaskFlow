import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownRight, ArrowUpRight, BarChart3, FileSpreadsheet, FileText, Loader2, Minus, Printer } from "lucide-react";
import { toast } from "sonner";
import { addDays, PRIORITY_LABELS, toISODate, type ReportData, type ReportTotals, type TaskPriority } from "@andamo/shared";
import { EmptyState } from "@/components/feedback/EmptyState";
import { InlineError } from "@/components/feedback/InlineError";
import { UserAvatar } from "@/components/feedback/UserAvatar";
import { useCrumbs } from "@/components/layout/AppHeader";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDuration } from "@/features/time/api";
import { workspacesApi } from "@/features/workspaces/api";
import { useCurrentWorkspace, useMembers, useProjects } from "@/features/workspaces/hooks";
import { getErrorMessage } from "@/lib/api-client";
import { downloadCsv, downloadXlsx, type Cell } from "@/lib/export";
import { cn } from "@/lib/utils";

type Preset = "7d" | "30d" | "90d" | "month" | "lastMonth" | "custom";

function presetRange(p: Preset, custom: { from: string; to: string }) {
  const today = toISODate();
  const d = new Date();
  if (p === "7d") return { from: addDays(today, -6), to: today };
  if (p === "30d") return { from: addDays(today, -29), to: today };
  if (p === "90d") return { from: addDays(today, -89), to: today };
  if (p === "month") return { from: toISODate(new Date(d.getFullYear(), d.getMonth(), 1)), to: today };
  if (p === "lastMonth") return { from: toISODate(new Date(d.getFullYear(), d.getMonth() - 1, 1)), to: toISODate(new Date(d.getFullYear(), d.getMonth(), 0)) };
  return custom;
}

const fmtDate = (iso: string) => new Date(`${iso}T12:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
const hours = (s: number) => Math.round((s / 3600) * 100) / 100;

/** Variação contra o período anterior. `goodWhenUp=false` para métricas em que subir é ruim (ex.: atrasos). */
function Delta({ now, before, goodWhenUp = true, suffix = "" }: { now: number | null; before: number | null; goodWhenUp?: boolean; suffix?: string }) {
  if (now === null || before === null) return <span className="text-xs text-muted-foreground">sem base de comparação</span>;
  const diff = now - before;
  if (diff === 0) return <span className="flex items-center gap-0.5 text-xs text-muted-foreground"><Minus className="h-3 w-3" /> igual ao período anterior</span>;
  const up = diff > 0;
  const good = up === goodWhenUp;
  const pct = before !== 0 ? ` (${up ? "+" : ""}${Math.round((diff / Math.abs(before)) * 100)}%)` : "";
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("flex items-center gap-0.5 text-xs font-medium", good ? "text-success" : "text-destructive")}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {up ? "+" : ""}
      {Number.isInteger(diff) ? diff : diff.toFixed(1)}
      {suffix}
      {pct} vs. anterior
    </span>
  );
}

function Kpi({ label, value, children }: { label: string; value: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-card break-inside-avoid">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-extrabold tabular-nums">{value}</p>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function EvolutionChart({ data }: { data: ReportData }) {
  const [show, setShow] = useState({ created: true, completed: true, hours: true });
  const [hover, setHover] = useState<number | null>(null);
  const s = data.series;
  const maxCount = Math.max(1, ...s.flatMap((p) => [show.created ? p.created : 0, show.completed ? p.completed : 0]));
  const maxHours = Math.max(0.01, ...s.map((p) => hours(p.trackedSeconds)));
  const W = 720;
  const H = 200;
  const slot = W / Math.max(1, s.length);
  const bar = Math.max(2, Math.min(14, slot / 3));
  const line = s.map((p, i) => `${i * slot + slot / 2},${H - (hours(p.trackedSeconds) / maxHours) * (H - 10)}`).join(" ");

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-4 text-xs print:hidden">
        {(
          [
            ["created", "Criadas", "bg-primary/35"],
            ["completed", "Concluídas", "bg-primary"],
            ["hours", "Horas registradas", "bg-coral"],
          ] as const
        ).map(([key, label, color]) => (
          <label key={key} className="flex items-center gap-1.5">
            <Checkbox checked={show[key]} onCheckedChange={(v) => setShow((o) => ({ ...o, [key]: v === true }))} />
            <span className={cn("h-2.5 w-2.5 rounded-sm", color)} /> {label}
          </label>
        ))}
      </div>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H + 22}`} className="h-56 w-full" role="img" aria-label="Evolução de tarefas criadas, concluídas e horas registradas">
          {[0.25, 0.5, 0.75, 1].map((f) => <line key={f} x1={0} x2={W} y1={H - H * f} y2={H - H * f} className="stroke-border" strokeDasharray="3 4" />)}
          {s.map((p, i) => {
            const x = i * slot + slot / 2;
            return (
              <g key={p.bucket} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                <rect x={i * slot} y={0} width={slot} height={H} fill="transparent" />
                {show.created && <rect x={x - bar - 1} y={H - (p.created / maxCount) * (H - 10)} width={bar} height={(p.created / maxCount) * (H - 10)} rx={2} className="fill-primary/35" />}
                {show.completed && <rect x={x + 1} y={H - (p.completed / maxCount) * (H - 10)} width={bar} height={(p.completed / maxCount) * (H - 10)} rx={2} className="fill-primary" />}
                {(s.length <= 16 || i % Math.ceil(s.length / 12) === 0) && (
                  <text x={x} y={H + 15} textAnchor="middle" className="fill-muted-foreground text-[10px]">{fmtDate(p.bucket)}</text>
                )}
              </g>
            );
          })}
          {show.hours && s.length > 1 && <polyline points={line} fill="none" className="stroke-coral" strokeWidth={2} strokeLinejoin="round" />}
        </svg>
        {hover !== null && (
          <div className="pointer-events-none absolute top-0 rounded-lg border bg-popover px-3 py-2 text-xs shadow-elevated" style={{ left: `min(${((hover + 0.5) / s.length) * 100}%, calc(100% - 170px))` }}>
            <p className="font-semibold">{data.granularity === "week" ? `Semana de ${fmtDate(s[hover].bucket)}` : fmtDate(s[hover].bucket)}</p>
            <p>Criadas: {s[hover].created}</p>
            <p>Concluídas: {s[hover].completed}</p>
            <p>Horas: {formatDuration(s[hover].trackedSeconds)}</p>
          </div>
        )}
      </div>
      <table className="sr-only">
        <caption>Evolução por {data.granularity === "week" ? "semana" : "dia"}</caption>
        <thead><tr><th>Período</th><th>Criadas</th><th>Concluídas</th><th>Horas</th></tr></thead>
        <tbody>{s.map((p) => <tr key={p.bucket}><td>{p.bucket}</td><td>{p.created}</td><td>{p.completed}</td><td>{hours(p.trackedSeconds)}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

function totalsRows(t: ReportTotals): Cell[][] {
  return [
    ["Tarefas criadas", t.created],
    ["Tarefas concluídas", t.completed],
    ["Atrasadas ao fim do período", t.overdue],
    ["Taxa de conclusão (%)", t.completionRate],
    ["Tempo médio de conclusão (h)", t.avgCompletionHours],
    ["Concluídas no prazo (%)", t.onTimeRate],
    ["Horas registradas", hours(t.trackedSeconds)],
  ];
}

function sheets(data: ReportData) {
  const cur = totalsRows(data.totals);
  const prev = totalsRows(data.previousTotals);
  return [
    {
      name: "Resumo",
      rows: [
        ["Indicador", `Período (${data.period.from} a ${data.period.to})`, `Anterior (${data.previous.from} a ${data.previous.to})`],
        ...cur.map((r, i) => [r[0], r[1], prev[i][1]]),
      ],
    },
    { name: "Evolução", rows: [["Período", "Criadas", "Concluídas", "Horas"], ...data.series.map((p) => [p.bucket, p.created, p.completed, hours(p.trackedSeconds)])] },
    {
      name: "Projetos",
      rows: [
        ["Projeto", "Abertas", "Concluídas no período", "Atrasadas", "Tempo médio de conclusão (h)", "Horas"],
        ...data.byProject.map((p) => [p.name, p.open, p.completed, p.overdue, p.avgCompletionHours, hours(p.trackedSeconds)]),
      ],
    },
    {
      name: "Pessoas",
      rows: [
        ["Pessoa", "Abertas", "Concluídas no período", "Atrasadas", "Estimativa aberta (h)", "Capacidade semanal (h)", "Horas registradas"],
        ...data.byPerson.map((p) => [p.user.name, p.open, p.completed, p.overdue, Math.round((p.openEstimateMinutes / 60) * 10) / 10, p.capacityHours, hours(p.trackedSeconds)]),
      ],
    },
    { name: "Prioridades", rows: [["Prioridade", "Abertas", "Concluídas no período"], ...data.byPriority.map((p) => [PRIORITY_LABELS[p.priority as TaskPriority] ?? p.priority, p.open, p.completed])] },
  ];
}

export default function ReportsPage() {
  const ws = useCurrentWorkspace();
  const [preset, setPreset] = useState<Preset>("30d");
  const [custom, setCustom] = useState({ from: addDays(toISODate(), -29), to: toISODate() });
  const [projectId, setProjectId] = useState("all");
  const [assigneeId, setAssigneeId] = useState("all");
  const projects = useProjects(ws.id).data ?? [];
  const members = useMembers(ws.id).data ?? [];
  useCrumbs([{ label: ws.name, to: `/app/w/${ws.id}` }, { label: "Relatórios" }]);

  const range = presetRange(preset, custom);
  const q = { ...range, projectId: projectId === "all" ? undefined : projectId, assigneeId: assigneeId === "all" ? undefined : assigneeId };
  const report = useQuery({ queryKey: ["workspaces", ws.id, "report", q], queryFn: () => workspacesApi.report(ws.id, q), placeholderData: (p) => p });
  const d = report.data;
  const fileBase = `andamo-relatorio-${range.from}-a-${range.to}`;
  const filterLabel = [
    projectId !== "all" ? projects.find((p) => p.id === projectId)?.name : "Todos os projetos",
    assigneeId !== "all" ? members.find((m) => m.id === assigneeId)?.name : "Todas as pessoas",
  ]
    .filter(Boolean)
    .join(" · ");

  const exportExcel = async () => {
    if (!d) return;
    try {
      await downloadXlsx(sheets(d), `${fileBase}.xlsx`);
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };
  const exportCsv = () => {
    if (!d) return;
    // CSV não tem várias abas: exporta o resumo seguido das tabelas, separadas por linhas em branco.
    const rows = sheets(d).flatMap((s, i) => [...(i ? [[], [s.name]] : [[s.name]]), ...s.rows]);
    downloadCsv(rows as Cell[][], `${fileBase}.csv`);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:py-8 print:max-w-none print:p-0">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">Relatórios</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {ws.name} · {fmtDate(range.from)} a {fmtDate(range.to)} · {filterLabel}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2 print:hidden">
          <Select value={preset} onValueChange={(v) => setPreset(v as Preset)}>
            <SelectTrigger className="h-9 w-40" aria-label="Período"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="90d">Últimos 90 dias</SelectItem>
              <SelectItem value="month">Este mês</SelectItem>
              <SelectItem value="lastMonth">Mês passado</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>
          {preset === "custom" && (
            <>
              <Input type="date" aria-label="De" className="h-9 w-40" value={custom.from} max={custom.to} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} />
              <Input type="date" aria-label="Até" className="h-9 w-40" value={custom.to} min={custom.from} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} />
            </>
          )}
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger className="h-9 w-44" aria-label="Projeto"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os projetos</SelectItem>
              {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={assigneeId} onValueChange={setAssigneeId}>
            <SelectTrigger className="h-9 w-44" aria-label="Pessoa"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as pessoas</SelectItem>
              {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" className="h-9" disabled={!d} onClick={exportCsv}><FileText /> CSV</Button>
          <Button variant="outline" className="h-9" disabled={!d} onClick={() => void exportExcel()}><FileSpreadsheet /> Excel</Button>
          <Button variant="outline" className="h-9" disabled={!d} onClick={() => window.print()} title="Abre a impressão; escolha “Salvar como PDF”"><Printer /> PDF</Button>
          {report.isFetching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Atualizando" />}
        </div>
      </div>

      {report.isError && <InlineError>{getErrorMessage(report.error)}</InlineError>}
      {!d ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : d.totals.created + d.totals.completed + d.byProject.reduce((a, p) => a + p.open, 0) === 0 ? (
        <EmptyState icon={BarChart3} title="Sem dados neste período" description="Crie e conclua tarefas para acompanhar a evolução da equipe aqui." />
      ) : (
        <>
          <p className="text-xs text-muted-foreground">Comparado com {fmtDate(d.previous.from)} a {fmtDate(d.previous.to)} (período anterior de mesma duração).</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 print:grid-cols-4">
            <Kpi label="Tarefas concluídas" value={String(d.totals.completed)}><Delta now={d.totals.completed} before={d.previousTotals.completed} /></Kpi>
            <Kpi label="Tarefas criadas" value={String(d.totals.created)}><Delta now={d.totals.created} before={d.previousTotals.created} /></Kpi>
            <Kpi label="Taxa de conclusão" value={`${d.totals.completionRate}%`}><Delta now={d.totals.completionRate} before={d.previousTotals.completionRate} suffix=" p.p." /></Kpi>
            <Kpi label="Atrasadas ao fim do período" value={String(d.totals.overdue)}><Delta now={d.totals.overdue} before={d.previousTotals.overdue} goodWhenUp={false} /></Kpi>
            <Kpi label="Tempo médio de conclusão" value={d.totals.avgCompletionHours === null ? "—" : d.totals.avgCompletionHours >= 48 ? `${Math.round(d.totals.avgCompletionHours / 24)} dias` : `${d.totals.avgCompletionHours} h`}>
              <Delta now={d.totals.avgCompletionHours} before={d.previousTotals.avgCompletionHours} goodWhenUp={false} suffix=" h" />
            </Kpi>
            <Kpi label="Concluídas no prazo" value={d.totals.onTimeRate === null ? "—" : `${d.totals.onTimeRate}%`}><Delta now={d.totals.onTimeRate} before={d.previousTotals.onTimeRate} suffix=" p.p." /></Kpi>
            <Kpi label="Horas registradas" value={formatDuration(d.totals.trackedSeconds)}><Delta now={hours(d.totals.trackedSeconds)} before={hours(d.previousTotals.trackedSeconds)} suffix=" h" /></Kpi>
            <Kpi label="Projetos com atividade" value={String(d.byProject.filter((p) => p.completed || p.open).length)}><span className="text-xs text-muted-foreground">de {d.byProject.length} projetos</span></Kpi>
          </div>

          <section className="rounded-xl border bg-card p-5 shadow-card break-inside-avoid">
            <h2 className="mb-3 font-display font-bold">Evolução {d.granularity === "week" ? "semanal" : "diária"}</h2>
            <EvolutionChart data={d} />
          </section>

          <section className="overflow-hidden rounded-xl border bg-card shadow-card break-inside-avoid">
            <h2 className="border-b px-5 py-3 font-display font-bold">Desempenho por projeto</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr><th className="px-5 py-2 font-medium">Projeto</th><th className="px-3 py-2 text-right font-medium">Abertas</th><th className="px-3 py-2 text-right font-medium">Concluídas</th><th className="px-3 py-2 text-right font-medium">Atrasadas</th><th className="px-3 py-2 text-right font-medium">Tempo médio</th><th className="px-5 py-2 text-right font-medium">Horas</th></tr>
                </thead>
                <tbody className="divide-y">
                  {d.byProject.map((p) => (
                    <tr key={p.projectId}>
                      <td className="px-5 py-2"><span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded" style={{ background: p.color }} /> {p.name}</span></td>
                      <td className="px-3 py-2 text-right tabular-nums">{p.open}</td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums text-success">{p.completed}</td>
                      <td className={cn("px-3 py-2 text-right tabular-nums", p.overdue > 0 && "font-semibold text-destructive")}>{p.overdue}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{p.avgCompletionHours === null ? "—" : `${p.avgCompletionHours} h`}</td>
                      <td className="px-5 py-2 text-right tabular-nums">{formatDuration(p.trackedSeconds)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border bg-card shadow-card break-inside-avoid">
            <h2 className="border-b px-5 py-3 font-display font-bold">Produtividade e carga de trabalho</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr><th className="px-5 py-2 font-medium">Pessoa</th><th className="px-3 py-2 text-right font-medium">Concluídas</th><th className="px-3 py-2 text-right font-medium">Abertas</th><th className="px-3 py-2 text-right font-medium">Atrasadas</th><th className="px-3 py-2 font-medium">Carga aberta × capacidade</th><th className="px-5 py-2 text-right font-medium">Horas</th></tr>
                </thead>
                <tbody className="divide-y">
                  {d.byPerson.map((p) => {
                    const est = p.openEstimateMinutes / 60;
                    const ratio = p.capacityHours ? est / p.capacityHours : null;
                    return (
                      <tr key={p.user.id}>
                        <td className="px-5 py-2"><span className="flex items-center gap-2"><UserAvatar user={p.user} className="h-6 w-6 ring-0" /> {p.user.name}</span></td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums text-success">{p.completed}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{p.open}</td>
                        <td className={cn("px-3 py-2 text-right tabular-nums", p.overdue > 0 && "font-semibold text-destructive")}>{p.overdue}</td>
                        <td className="px-3 py-2">
                          {ratio === null ? (
                            <span className="text-xs text-muted-foreground">{est ? `${Math.round(est * 10) / 10} h estimadas · capacidade não definida` : "—"}</span>
                          ) : (
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-28 overflow-hidden rounded-full bg-muted">
                                <div className={cn("h-full rounded-full", ratio > 1 ? "bg-destructive" : ratio > 0.8 ? "bg-warning" : "bg-success")} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
                              </div>
                              <span className="text-xs tabular-nums">{Math.round(est * 10) / 10}/{p.capacityHours} h</span>
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-2 text-right tabular-nums">{formatDuration(p.trackedSeconds)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="border-t px-5 py-2 text-xs text-muted-foreground">Carga = soma das estimativas das tarefas abertas. A capacidade semanal é definida em Equipe → Editar.</p>
          </section>

          <section className="rounded-xl border bg-card p-5 shadow-card break-inside-avoid">
            <h2 className="mb-3 font-display font-bold">Por prioridade</h2>
            <div className="grid gap-3 sm:grid-cols-4">
              {(["urgente", "alta", "media", "baixa"] as TaskPriority[]).map((pr) => {
                const row = d.byPriority.find((x) => x.priority === pr);
                return (
                  <div key={pr} className="rounded-lg border p-3">
                    <p className="text-sm font-semibold">{PRIORITY_LABELS[pr]}</p>
                    <p className="text-xs text-muted-foreground">{row?.open ?? 0} abertas · {row?.completed ?? 0} concluídas</p>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
