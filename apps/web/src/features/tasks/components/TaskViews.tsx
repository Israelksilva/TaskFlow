import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { Archive, ArrowDownUp, CheckCircle2, Trash2, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import {
  addDays,
  PRIORITY_LABELS,
  PRIORITY_WEIGHT,
  STATUS_LABELS,
  TASK_PRIORITIES,
  TASK_STATUSES,
  toISODate,
  type Label,
  type Member,
  type Task,
  type TaskPriority,
  type TaskStatus,
} from "@andamo/shared";
import { AvatarStack } from "@/components/feedback/UserAvatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getErrorMessage } from "@/lib/api-client";
import { formatDate, formatMinutes } from "@/lib/format";
import { cn } from "@/lib/utils";
import { tasksApi } from "../api";
import { LabelChip } from "./Pickers";
import { DueDateBadge, PriorityBadge } from "./TaskBadges";
import { STATUS_META } from "./task-meta";

interface ViewProps {
  tasks: Task[];
  members: Member[];
  labels: Label[];
  workspaceId: string;
  canEdit: boolean;
}

function useOpenTask() {
  const [, setParams] = useSearchParams();
  return (id: string) =>
    setParams((p) => {
      p.set("tarefa", id);
      return p;
    });
}

// ---------------------------------------------------------------- ações em massa
function BulkBar({ ids, workspaceId, members, onDone }: { ids: string[]; workspaceId: string; members: Member[]; onDone: () => void }) {
  const qc = useQueryClient();
  const bulk = useMutation({
    mutationFn: (input: Parameters<typeof tasksApi.bulk>[1]) => tasksApi.bulk(workspaceId, input),
    onSuccess: (r) => {
      if (r.failed.length) toast.warning(`${r.ok} atualizada(s), ${r.failed.length} com erro`, { description: r.failed[0].message });
      else toast.success(`${r.ok} tarefa(s) atualizada(s)`);
      onDone();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
    onSettled: () => qc.invalidateQueries({ queryKey: ["tasks", workspaceId] }),
  });
  if (!ids.length) return null;
  return (
    <div role="toolbar" aria-label="Ações em massa" className="sticky bottom-4 z-20 mx-auto flex w-fit flex-wrap items-center gap-2 rounded-xl border bg-popover px-3 py-2 shadow-elevated animate-pop-in">
      <span className="text-sm font-medium">{ids.length} selecionada(s)</span>
      <Select onValueChange={(v) => bulk.mutate({ ids, action: "status", status: v as TaskStatus })}>
        <SelectTrigger className="h-8 w-36" aria-label="Mudar status">
          <span className="flex items-center gap-1.5 text-sm"><CheckCircle2 className="h-4 w-4" /> Status</span>
        </SelectTrigger>
        <SelectContent>
          {TASK_STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select onValueChange={(v) => bulk.mutate({ ids, action: "priority", priority: v as TaskPriority })}>
        <SelectTrigger className="h-8 w-36" aria-label="Mudar prioridade">
          <span className="flex items-center gap-1.5 text-sm"><ArrowDownUp className="h-4 w-4" /> Prioridade</span>
        </SelectTrigger>
        <SelectContent>
          {TASK_PRIORITIES.map((p) => <SelectItem key={p} value={p}>{PRIORITY_LABELS[p]}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select onValueChange={(v) => bulk.mutate({ ids, action: "assign", assigneeId: v })}>
        <SelectTrigger className="h-8 w-36" aria-label="Atribuir">
          <span className="flex items-center gap-1.5 text-sm"><UserPlus className="h-4 w-4" /> Atribuir</span>
        </SelectTrigger>
        <SelectContent>
          {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
        </SelectContent>
      </Select>
      <Button size="sm" variant="outline" className="h-8" onClick={() => bulk.mutate({ ids, action: "archive" })}>
        <Archive /> Arquivar
      </Button>
      <Button size="sm" variant="outline" className="h-8 text-destructive" onClick={() => bulk.mutate({ ids, action: "delete" })}>
        <Trash2 /> Lixeira
      </Button>
      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onDone} aria-label="Limpar seleção">
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

function useSelection() {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  return {
    selected,
    toggle: (id: string) =>
      setSelected((s) => {
        const n = new Set(s);
        if (n.has(id)) n.delete(id);
        else n.add(id);
        return n;
      }),
    setAll: (ids: string[], on: boolean) =>
      setSelected((s) => {
        const n = new Set(s);
        for (const id of ids) {
          if (on) n.add(id);
          else n.delete(id);
        }
        return n;
      }),
    clear: () => setSelected(new Set()),
  };
}

// ---------------------------------------------------------------- lista agrupada
type GroupBy = "status" | "priority" | "assignee" | "label";

export function TaskListView({ tasks, members, labels, workspaceId, canEdit }: ViewProps) {
  const open = useOpenTask();
  const sel = useSelection();
  const [groupBy, setGroupBy] = useState<GroupBy>("status");
  const memberMap = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const labelMap = useMemo(() => new Map(labels.map((l) => [l.id, l])), [labels]);

  const groups = useMemo(() => {
    const out = new Map<string, { label: string; tasks: Task[] }>();
    const add = (key: string, label: string, t: Task) => {
      if (!out.has(key)) out.set(key, { label, tasks: [] });
      out.get(key)!.tasks.push(t);
    };
    if (groupBy === "status") TASK_STATUSES.forEach((s) => out.set(s, { label: STATUS_LABELS[s], tasks: [] }));
    if (groupBy === "priority") [...TASK_PRIORITIES].reverse().forEach((p) => out.set(p, { label: PRIORITY_LABELS[p], tasks: [] }));
    for (const t of tasks) {
      if (groupBy === "status") add(t.status, STATUS_LABELS[t.status], t);
      else if (groupBy === "priority") add(t.priority, PRIORITY_LABELS[t.priority], t);
      else if (groupBy === "assignee") {
        if (!t.assigneeIds.length) add("none", "Sem responsável", t);
        for (const id of t.assigneeIds) add(id, memberMap.get(id)?.name ?? "Ex-membro", t);
      } else {
        if (!t.labelIds.length) add("none", "Sem etiqueta", t);
        for (const id of t.labelIds) add(id, labelMap.get(id)?.name ?? "Etiqueta", t);
      }
    }
    return [...out.entries()].filter(([, g]) => g.tasks.length || groupBy === "status");
  }, [tasks, groupBy, memberMap, labelMap]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Agrupar por</span>
        <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupBy)}>
          <SelectTrigger className="h-8 w-40" aria-label="Agrupar por">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="status">Status</SelectItem>
            <SelectItem value="priority">Prioridade</SelectItem>
            <SelectItem value="assignee">Responsável</SelectItem>
            <SelectItem value="label">Etiqueta</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {groups.map(([key, group]) => {
        const ids = group.tasks.map((t) => t.id);
        const allOn = ids.length > 0 && ids.every((id) => sel.selected.has(id));
        const Icon = groupBy === "status" ? STATUS_META[key as TaskStatus].icon : null;
        return (
          <section key={key} className="overflow-hidden rounded-xl border bg-card shadow-card" aria-label={group.label}>
            <header className="flex items-center gap-2.5 border-b bg-muted/30 px-4 py-2">
              {canEdit && <Checkbox checked={allOn} onCheckedChange={(v) => sel.setAll(ids, v === true)} aria-label={`Selecionar todas em ${group.label}`} disabled={!ids.length} />}
              {Icon && <Icon className={cn("h-4 w-4", STATUS_META[key as TaskStatus].className)} aria-hidden />}
              <h3 className="text-sm font-semibold">{group.label}</h3>
              <span className="text-xs text-muted-foreground">{group.tasks.length}</span>
            </header>
            {group.tasks.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted-foreground">Nenhuma tarefa.</p>
            ) : (
              <ul className="divide-y">
                {group.tasks.map((t) => (
                  <li key={`${key}-${t.id}`} className={cn("flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-accent/50", sel.selected.has(t.id) && "bg-primary/5")}>
                    {canEdit && <Checkbox checked={sel.selected.has(t.id)} onCheckedChange={() => sel.toggle(t.id)} aria-label={`Selecionar ${t.title}`} />}
                    <button className="min-w-0 flex-1 truncate text-left text-sm font-medium hover:text-primary" onClick={() => open(t.id)}>
                      <span className={cn(t.status === "done" && "text-muted-foreground line-through")}>{t.title}</span>
                    </button>
                    <span className="hidden gap-1 md:flex">
                      {t.labelIds.slice(0, 2).map((id) => labelMap.get(id)).filter(Boolean).map((l) => <LabelChip key={l!.id} label={l!} />)}
                    </span>
                    <PriorityBadge priority={t.priority} />
                    <span className="hidden w-24 sm:block"><DueDateBadge task={t} /></span>
                    <AvatarStack users={t.assigneeIds.map((id) => memberMap.get(id)).filter((m): m is Member => Boolean(m))} max={2} className="w-12 justify-end" />
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
      <BulkBar ids={[...sel.selected]} workspaceId={workspaceId} members={members} onDone={sel.clear} />
    </div>
  );
}

// ---------------------------------------------------------------- tabela ordenável
type SortKey = "title" | "status" | "priority" | "dueDate" | "estimate" | "progress";

export function TaskTableView({ tasks, members, workspaceId, canEdit }: ViewProps) {
  const open = useOpenTask();
  const sel = useSelection();
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "dueDate", dir: 1 });
  const memberMap = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);

  const sorted = useMemo(() => {
    const val = (t: Task): string | number => {
      switch (sort.key) {
        case "title": return t.title.toLowerCase();
        case "status": return TASK_STATUSES.indexOf(t.status);
        case "priority": return PRIORITY_WEIGHT[t.priority];
        case "dueDate": return t.dueDate ?? "9999";
        case "estimate": return t.estimateMinutes ?? -1;
        case "progress": return t.progress;
      }
    };
    return [...tasks].sort((a, b) => (val(a) > val(b) ? 1 : val(a) < val(b) ? -1 : 0) * sort.dir);
  }, [tasks, sort]);

  const th = (key: SortKey, label: string, className = "") => (
    <th scope="col" className={cn("px-3 py-2 font-medium", className)} aria-sort={sort.key === key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
      <button className="flex items-center gap-1 hover:text-foreground" onClick={() => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : 1 }))}>
        {label} {sort.key === key && (sort.dir === 1 ? "↑" : "↓")}
      </button>
    </th>
  );

  return (
    <>
      <div className="overflow-x-auto rounded-xl border bg-card shadow-card">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
            <tr>
              {canEdit && (
                <th className="w-10 px-3 py-2">
                  <Checkbox checked={tasks.length > 0 && tasks.every((t) => sel.selected.has(t.id))} onCheckedChange={(v) => sel.setAll(tasks.map((t) => t.id), v === true)} aria-label="Selecionar todas" />
                </th>
              )}
              {th("title", "Tarefa")}
              {th("status", "Status")}
              {th("priority", "Prioridade")}
              <th className="px-3 py-2 font-medium">Responsáveis</th>
              {th("dueDate", "Prazo")}
              {th("estimate", "Estimativa", "text-right")}
              {th("progress", "Progresso", "text-right")}
            </tr>
          </thead>
          <tbody className="divide-y">
            {sorted.map((t) => (
              <tr key={t.id} className={cn("hover:bg-accent/40", sel.selected.has(t.id) && "bg-primary/5")}>
                {canEdit && (
                  <td className="px-3 py-2">
                    <Checkbox checked={sel.selected.has(t.id)} onCheckedChange={() => sel.toggle(t.id)} aria-label={`Selecionar ${t.title}`} />
                  </td>
                )}
                <td className="max-w-xs px-3 py-2">
                  <button className="truncate text-left font-medium hover:text-primary" onClick={() => open(t.id)}>{t.title}</button>
                </td>
                <td className="px-3 py-2">{STATUS_LABELS[t.status]}</td>
                <td className="px-3 py-2"><PriorityBadge priority={t.priority} /></td>
                <td className="px-3 py-2"><AvatarStack users={t.assigneeIds.map((id) => memberMap.get(id)).filter((m): m is Member => Boolean(m))} /></td>
                <td className="px-3 py-2">{t.dueDate ? formatDate(t.dueDate) : "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatMinutes(t.estimateMinutes)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{t.progress}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <BulkBar ids={[...sel.selected]} workspaceId={workspaceId} members={members} onDone={sel.clear} />
    </>
  );
}

// ---------------------------------------------------------------- timeline / Gantt
const DAY_W = 32;

export function TaskTimelineView({ tasks, members }: ViewProps) {
  const open = useOpenTask();
  const memberMap = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const scheduled = tasks.filter((t) => t.dueDate || t.startDate);
  const today = toISODate();
  const dates = scheduled.flatMap((t) => [t.startDate ?? t.dueDate!, t.dueDate ?? t.startDate!]);
  const min = dates.length ? dates.reduce((a, b) => (a < b ? a : b)) : today;
  const max = dates.length ? dates.reduce((a, b) => (a > b ? a : b)) : today;
  const start = addDays(min < today ? min : today, -2);
  const end = addDays(max > today ? max : today, 5);
  const days: string[] = [];
  for (let d = start; d <= end && days.length < 180; d = addDays(d, 1)) days.push(d);
  const index = (d: string) => days.indexOf(d);

  if (!scheduled.length) {
    return <p className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">Defina datas de início ou prazo nas tarefas para vê-las na linha do tempo.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border bg-card shadow-card">
      <div style={{ width: 240 + days.length * DAY_W }} className="relative">
        <div className="sticky top-0 z-10 flex border-b bg-card">
          <div className="sticky left-0 z-10 w-60 shrink-0 border-r bg-card px-3 py-2 text-xs font-medium text-muted-foreground">Tarefa</div>
          {days.map((d) => (
            <div key={d} className={cn("shrink-0 border-r py-2 text-center text-[10px] text-muted-foreground", d === today && "bg-primary/10 font-bold text-primary", new Date(`${d}T12:00`).getDay() % 6 === 0 && "bg-muted/40")} style={{ width: DAY_W }}>
              {d.slice(8, 10)}
              {d.endsWith("-01") || d === days[0] ? <div className="text-[9px]">{new Date(`${d}T12:00`).toLocaleDateString("pt-BR", { month: "short" })}</div> : null}
            </div>
          ))}
        </div>
        {scheduled.map((t) => {
          const s = index(t.startDate ?? t.dueDate!);
          const e = index(t.dueDate ?? t.startDate!);
          const left = Math.max(0, Math.min(s, e));
          const width = (Math.abs(e - s) + 1) * DAY_W - 6;
          const overdue = t.status !== "done" && t.dueDate !== null && t.dueDate < today;
          return (
            <div key={t.id} className="flex h-10 items-center border-b last:border-b-0 hover:bg-accent/30">
              <button onClick={() => open(t.id)} className="sticky left-0 z-[5] flex h-full w-60 shrink-0 items-center gap-2 truncate border-r bg-card px-3 text-left text-sm hover:text-primary">
                <span className="truncate">{t.title}</span>
              </button>
              <div className="relative h-full flex-1">
                <button
                  onClick={() => open(t.id)}
                  title={`${t.title}${t.startDate ? ` · início ${formatDate(t.startDate)}` : ""}${t.dueDate ? ` · prazo ${formatDate(t.dueDate)}` : ""}`}
                  className={cn(
                    "absolute top-2 flex h-6 items-center gap-1 overflow-hidden rounded-md px-2 text-[11px] font-medium text-white shadow-sm transition-transform hover:scale-y-110",
                    t.status === "done" ? "bg-success" : overdue ? "bg-destructive" : t.status === "doing" ? "bg-primary" : "bg-slate-400 dark:bg-slate-500",
                  )}
                  style={{ left: left * DAY_W + 3, width }}
                >
                  <span className="truncate">{t.progress > 0 && t.status !== "done" ? `${t.progress}%` : ""}</span>
                  <AvatarStack users={t.assigneeIds.map((id) => memberMap.get(id)).filter((m): m is Member => Boolean(m))} max={1} className="ml-auto scale-75" />
                </button>
              </div>
            </div>
          );
        })}
        <div className="pointer-events-none absolute bottom-0 top-0 w-0.5 bg-primary/60" style={{ left: 240 + index(today) * DAY_W + DAY_W / 2 }} aria-hidden />
      </div>
    </div>
  );
}
