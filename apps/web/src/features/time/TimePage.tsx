import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, Download, Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { addDays, can, toISODate, type TimeEntry } from "@andamo/shared";
import { EmptyState } from "@/components/feedback/EmptyState";
import { InlineError } from "@/components/feedback/InlineError";
import { UserAvatar } from "@/components/feedback/UserAvatar";
import { useCrumbs } from "@/components/layout/AppHeader";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/features/auth/use-auth";
import { useCurrentWorkspace, useMembers, useProjects } from "@/features/workspaces/hooks";
import { getErrorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { formatDuration, timeApi } from "./api";
import { timeKeys } from "./hooks";

type Period = "week" | "7d" | "30d" | "month" | "custom";

function periodRange(p: Period, custom: { from: string; to: string }) {
  const today = toISODate();
  const d = new Date();
  if (p === "week") return { from: addDays(today, -((d.getDay() + 6) % 7)), to: today };
  if (p === "7d") return { from: addDays(today, -6), to: today };
  if (p === "30d") return { from: addDays(today, -29), to: today };
  if (p === "month") return { from: toISODate(new Date(d.getFullYear(), d.getMonth(), 1)), to: today };
  return custom;
}

const hours = (s: number) => (s / 3600).toLocaleString("pt-BR", { maximumFractionDigits: 2 });

/** CSV com separador ";" (abre corretamente no Excel em português). */
function exportCsv(entries: TimeEntry[], projectName: (id: string) => string) {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const rows = [
    ["Data", "Início", "Fim", "Pessoa", "Projeto", "Tarefa", "Horas", "Minutos", "Origem", "Observação"],
    ...entries.map((e) => {
      const start = new Date(e.startedAt);
      return [
        start.toLocaleDateString("pt-BR"),
        start.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        e.endedAt ? new Date(e.endedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "em andamento",
        e.user.name,
        projectName(e.projectId),
        e.taskTitle,
        hours(e.durationSeconds),
        String(Math.round(e.durationSeconds / 60)),
        e.source === "manual" ? "Manual" : "Cronômetro",
        e.note ?? "",
      ];
    }),
  ];
  const csv = "﻿" + rows.map((r) => r.map(esc).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  Object.assign(document.createElement("a"), { href: url, download: "andamo-tempo.csv" }).click();
  URL.revokeObjectURL(url);
}

function Bar({ label, seconds, max, color, extra }: { label: React.ReactNode; seconds: number; max: number; color?: string; extra?: React.ReactNode }) {
  return (
    <li className="space-y-1">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="flex min-w-0 items-center gap-2 truncate">{label}</span>
        <span className="shrink-0 tabular-nums text-muted-foreground">{formatDuration(seconds)}{extra}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-brand" style={{ width: `${max ? (seconds / max) * 100 : 0}%`, background: color }} />
      </div>
    </li>
  );
}

function EditEntryDialog({ entry, workspaceId, onClose }: { entry: TimeEntry | null; workspaceId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [minutes, setMinutes] = useState("");
  const [note, setNote] = useState("");
  useEffect(() => {
    if (!entry) return;
    setMinutes(String(Math.round(entry.durationSeconds / 60)));
    setNote(entry.note ?? "");
  }, [entry]);
  const save = useMutation({
    mutationFn: () => timeApi.update(workspaceId, entry!.id, { minutes: Math.round(Number(minutes)), note: note || null }),
    onSuccess: () => {
      toast.success("Registro atualizado");
      void qc.invalidateQueries({ queryKey: timeKeys.all(workspaceId) });
      void qc.invalidateQueries({ queryKey: ["tasks", workspaceId] });
      onClose();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
  return (
    <Dialog open={Boolean(entry)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Editar registro</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{entry?.taskTitle}</p>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label htmlFor="ed-min">Minutos</Label><Input id="ed-min" type="number" min={1} max={1440} value={minutes} onChange={(e) => setMinutes(e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="ed-note">Observação</Label><Input id="ed-note" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button disabled={save.isPending || Number(minutes) < 1} onClick={() => save.mutate()}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function TimePage() {
  const ws = useCurrentWorkspace();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [, setParams] = useSearchParams();
  const [period, setPeriod] = useState<Period>("week");
  const [custom, setCustom] = useState({ from: addDays(toISODate(), -13), to: toISODate() });
  const [projectId, setProjectId] = useState("all");
  const [userId, setUserId] = useState("all");
  const [editing, setEditing] = useState<TimeEntry | null>(null);
  const projects = useProjects(ws.id).data ?? [];
  const members = useMembers(ws.id).data ?? [];
  useCrumbs([{ label: ws.name, to: `/app/w/${ws.id}` }, { label: "Controle de tempo" }]);

  const range = periodRange(period, custom);
  const q = { ...range, projectId: projectId === "all" ? undefined : projectId, userId: userId === "all" ? undefined : userId };
  const summary = useQuery({ queryKey: [...timeKeys.all(ws.id), "summary", q], queryFn: () => timeApi.summary(ws.id, q), placeholderData: (p) => p });
  const entries = useQuery({ queryKey: [...timeKeys.all(ws.id), "list", q], queryFn: () => timeApi.list(ws.id, q), placeholderData: (p) => p });
  const remove = useMutation({
    mutationFn: (id: string) => timeApi.remove(ws.id, id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: timeKeys.all(ws.id) });
      void qc.invalidateQueries({ queryKey: ["tasks", ws.id] });
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const s = summary.data;
  const projectName = (id: string) => projects.find((p) => p.id === id)?.name ?? "Projeto";
  const days = useMemo(() => {
    const out: Array<{ date: string; seconds: number }> = [];
    const map = new Map((s?.byDay ?? []).map((d) => [d.date, d.seconds]));
    for (let d = range.from, i = 0; d <= range.to && i < 92; d = addDays(d, 1), i++) out.push({ date: d, seconds: map.get(d) ?? 0 });
    return out;
  }, [s, range.from, range.to]);
  const maxDay = Math.max(1, ...days.map((d) => d.seconds));
  const workdays = days.filter((d) => d.seconds > 0).length;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:py-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">Controle de tempo</h1>
          <p className="mt-1 text-sm text-muted-foreground">Horas registradas em {ws.name}. Inicie o cronômetro no painel de qualquer tarefa.</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <SelectTrigger className="h-9 w-40" aria-label="Período"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Esta semana</SelectItem>
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="month">Este mês</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>
          {period === "custom" && (
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
          <Select value={userId} onValueChange={setUserId}>
            <SelectTrigger className="h-9 w-44" aria-label="Pessoa"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as pessoas</SelectItem>
              {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" className="h-9" disabled={!entries.data?.length} onClick={() => exportCsv(entries.data ?? [], projectName)}>
            <Download /> CSV
          </Button>
          {(summary.isFetching || entries.isFetching) && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Atualizando" />}
        </div>
      </div>

      {(summary.isError || entries.isError) && <InlineError>{getErrorMessage(summary.error ?? entries.error)}</InlineError>}

      {!s ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : s.totalSeconds === 0 ? (
        <EmptyState icon={Clock} title="Nenhuma hora registrada no período" description="Abra uma tarefa e clique em “Iniciar cronômetro”, ou registre tempo manualmente." />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border bg-card p-4 shadow-card">
              <p className="text-xs text-muted-foreground">Total no período</p>
              <p className="mt-1 font-display text-3xl font-extrabold tabular-nums">{hours(s.totalSeconds)} h</p>
            </div>
            <div className="rounded-xl border bg-card p-4 shadow-card">
              <p className="text-xs text-muted-foreground">Média por dia com registro</p>
              <p className="mt-1 font-display text-3xl font-extrabold tabular-nums">{formatDuration(workdays ? s.totalSeconds / workdays : 0)}</p>
            </div>
            <div className="rounded-xl border bg-card p-4 shadow-card">
              <p className="text-xs text-muted-foreground">Tarefas com tempo</p>
              <p className="mt-1 font-display text-3xl font-extrabold tabular-nums">{s.byTask.length}</p>
            </div>
          </div>

          <section className="rounded-xl border bg-card p-5 shadow-card" aria-label="Horas por dia">
            <h2 className="mb-4 font-display font-bold">Horas por dia</h2>
            <div className="flex h-40 items-end gap-1" role="img" aria-label="Gráfico de horas por dia">
              {days.map((d) => (
                <div key={d.date} className="group relative flex h-full flex-1 flex-col justify-end" title={`${new Date(`${d.date}T12:00`).toLocaleDateString("pt-BR")}: ${formatDuration(d.seconds)}`}>
                  <div className={cn("w-full rounded-t-sm transition-colors", d.seconds ? "bg-primary group-hover:bg-primary/80" : "bg-muted")} style={{ height: `${Math.max(2, (d.seconds / maxDay) * 100)}%` }} />
                </div>
              ))}
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
              <span>{new Date(`${range.from}T12:00`).toLocaleDateString("pt-BR", { day: "numeric", month: "short" })}</span>
              <span>{new Date(`${range.to}T12:00`).toLocaleDateString("pt-BR", { day: "numeric", month: "short" })}</span>
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-xl border bg-card p-5 shadow-card">
              <h2 className="mb-4 font-display font-bold">Por projeto</h2>
              <ul className="space-y-3">
                {s.byProject.map((p) => (
                  <Bar key={p.projectId} max={s.byProject[0].seconds} seconds={p.seconds} color={p.color} label={<><span className="h-2.5 w-2.5 shrink-0 rounded" style={{ background: p.color }} /> {p.name}</>} />
                ))}
              </ul>
            </section>
            <section className="rounded-xl border bg-card p-5 shadow-card">
              <h2 className="mb-4 font-display font-bold">Por pessoa</h2>
              <ul className="space-y-3">
                {s.byUser.map((u) => (
                  <Bar key={u.user.id} max={s.byUser[0].seconds} seconds={u.seconds} label={<><UserAvatar user={u.user} className="h-5 w-5 ring-0" /> {u.user.name}</>} />
                ))}
              </ul>
            </section>
          </div>

          <section className="overflow-hidden rounded-xl border bg-card shadow-card" aria-label="Estimado versus realizado">
            <h2 className="border-b px-5 py-3 font-display font-bold">Estimado × realizado</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr><th className="px-5 py-2 font-medium">Tarefa</th><th className="px-3 py-2 text-right font-medium">Estimado</th><th className="px-3 py-2 text-right font-medium">Realizado</th><th className="px-5 py-2 text-right font-medium">Desvio</th></tr>
                </thead>
                <tbody className="divide-y">
                  {s.byTask.map((t) => {
                    const est = t.estimateMinutes ? t.estimateMinutes * 60 : null;
                    const diff = est !== null ? t.trackedSeconds - est : null;
                    return (
                      <tr key={t.taskId} className="hover:bg-accent/40">
                        <td className="max-w-xs px-5 py-2">
                          <button className="truncate text-left font-medium hover:text-primary" onClick={() => setParams((p) => (p.set("tarefa", t.taskId), p))}>{t.title}</button>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{est !== null ? formatDuration(est) : "—"}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatDuration(t.trackedSeconds)}</td>
                        <td className={cn("px-5 py-2 text-right tabular-nums", diff !== null && diff > 0 ? "font-semibold text-destructive" : "text-success")}>
                          {diff === null ? "—" : `${diff > 0 ? "+" : "−"}${formatDuration(Math.abs(diff))}`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border bg-card shadow-card" aria-label="Registros">
            <h2 className="border-b px-5 py-3 font-display font-bold">Registros</h2>
            <ul className="divide-y">
              {(entries.data ?? []).slice(0, 200).map((e) => {
                const mine = e.user.id === user?.id || can(ws.role, "projects.manage");
                return (
                  <li key={e.id} className="flex flex-wrap items-center gap-3 px-5 py-2.5 text-sm">
                    <UserAvatar user={e.user} className="h-6 w-6 ring-0" />
                    <div className="min-w-0 flex-1">
                      <button className="block truncate text-left font-medium hover:text-primary" onClick={() => setParams((p) => (p.set("tarefa", e.taskId), p))}>{e.taskTitle}</button>
                      <p className="truncate text-xs text-muted-foreground">
                        {projectName(e.projectId)} · {new Date(e.startedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                        {e.source === "manual" && " · manual"}{e.note && ` · ${e.note}`}
                      </p>
                    </div>
                    <span className="w-20 text-right font-semibold tabular-nums">{e.endedAt ? formatDuration(e.durationSeconds) : "rodando"}</span>
                    {mine && e.endedAt && (
                      <span className="flex">
                        <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Editar registro" onClick={() => setEditing(e)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Excluir registro" onClick={() => remove.mutate(e.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}
      <EditEntryDialog entry={editing} workspaceId={ws.id} onClose={() => setEditing(null)} />
    </div>
  );
}
