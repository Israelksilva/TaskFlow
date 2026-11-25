import { useMemo, useState, type DragEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, Download, Plus } from "lucide-react";
import { addDays, can, toISODate, type Task } from "@andamo/shared";
import { InlineError } from "@/components/feedback/InlineError";
import { useCrumbs } from "@/components/layout/AppHeader";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { tasksApi } from "@/features/tasks/api";
import { QuickCreateDialog } from "@/features/tasks/components/QuickCreateDialog";
import { taskKeys } from "@/features/tasks/hooks";
import { useCurrentWorkspace, useProjects, useWsMutation } from "@/features/workspaces/hooks";
import { getErrorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";

type Mode = "month" | "week" | "day" | "agenda";
const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const parse = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};

function rangeFor(mode: Mode, anchor: string): { from: string; to: string; days: string[] } {
  const a = parse(anchor);
  if (mode === "day") return { from: anchor, to: anchor, days: [anchor] };
  if (mode === "week" || mode === "agenda") {
    const start = addDays(anchor, -a.getDay());
    const len = mode === "agenda" ? 30 : 7;
    const from = mode === "agenda" ? anchor : start;
    const days = Array.from({ length: len }, (_, i) => addDays(from, i));
    return { from, to: days[days.length - 1], days };
  }
  const first = toISODate(new Date(a.getFullYear(), a.getMonth(), 1));
  const gridStart = addDays(first, -parse(first).getDay());
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  return { from: days[0], to: days[41], days };
}

/** Exporta as tarefas com prazo como arquivo .ics (abre no Google Agenda, Outlook, Apple Calendário). */
function exportIcs(tasks: Task[], name: string) {
  const esc = (s: string) => s.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\r?\n/g, "\\n");
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const events = tasks
    .filter((t) => t.dueDate)
    .map((t) => {
      const d = t.dueDate!.replace(/-/g, "");
      const next = addDays(t.dueDate!, 1).replace(/-/g, "");
      const when = t.dueTime ? `DTSTART:${d}T${t.dueTime.replace(":", "")}00\r\nDURATION:PT30M` : `DTSTART;VALUE=DATE:${d}\r\nDTEND;VALUE=DATE:${next}`;
      return `BEGIN:VEVENT\r\nUID:${t.id}@andamo\r\nDTSTAMP:${stamp}\r\n${when}\r\nSUMMARY:${esc(t.title)}\r\n${t.description ? `DESCRIPTION:${esc(t.description.slice(0, 1000))}\r\n` : ""}END:VEVENT`;
    });
  const ics = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Andamo//PT-BR\r\nCALSCALE:GREGORIAN\r\nX-WR-CALNAME:${esc(name)}\r\n${events.join("\r\n")}\r\nEND:VCALENDAR\r\n`;
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: "andamo-prazos.ics" });
  a.click();
  URL.revokeObjectURL(url);
}

export default function CalendarPage() {
  const ws = useCurrentWorkspace();
  const [, setParams] = useSearchParams();
  const [mode, setMode] = useState<Mode>("month");
  const [anchor, setAnchor] = useState(toISODate());
  const [projectId, setProjectId] = useState("all");
  const [createOn, setCreateOn] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const projects = useProjects(ws.id).data ?? [];
  const projectMap = new Map(projects.map((p) => [p.id, p]));
  useCrumbs([{ label: ws.name, to: `/app/w/${ws.id}` }, { label: "Calendário" }]);

  const { from, to, days } = rangeFor(mode, anchor);
  const query = { from, to, includeSubtasks: "true" as const, ...(projectId !== "all" && { projectId }) };
  const tasks = useQuery({ queryKey: taskKeys.list(ws.id, query), queryFn: () => tasksApi.list(ws.id, query), placeholderData: (p) => p });
  const move = useWsMutation(({ id, dueDate }: { id: string; dueDate: string }) => tasksApi.update(ws.id, id, { dueDate }), {
    invalidate: [["tasks", ws.id]],
    success: "Prazo atualizado",
  });
  const canEdit = can(ws.role, "tasks.edit");

  const byDay = useMemo(() => {
    const m = new Map<string, Task[]>();
    for (const t of tasks.data ?? []) if (t.dueDate) m.set(t.dueDate, [...(m.get(t.dueDate) ?? []), t]);
    return m;
  }, [tasks.data]);

  const today = toISODate();
  const month = parse(anchor).getMonth();
  const step = (dir: 1 | -1) => {
    const a = parse(anchor);
    if (mode === "month") setAnchor(toISODate(new Date(a.getFullYear(), a.getMonth() + dir, 1)));
    else setAnchor(addDays(anchor, dir * (mode === "week" ? 7 : mode === "agenda" ? 30 : 1)));
  };
  const title =
    mode === "month"
      ? parse(anchor).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
      : mode === "day"
        ? parse(anchor).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })
        : `${parse(from).toLocaleDateString("pt-BR", { day: "numeric", month: "short" })} – ${parse(to).toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" })}`;

  const open = (id: string) =>
    setParams((p) => {
      p.set("tarefa", id);
      return p;
    });

  const onDrop = (e: DragEvent, day: string) => {
    e.preventDefault();
    setDragOver(null);
    const id = e.dataTransfer.getData("text/andamo-task");
    const task = tasks.data?.find((t) => t.id === id);
    if (task && task.dueDate !== day) move.mutate({ id, dueDate: day });
  };

  const chip = (t: Task) => {
    const p = projectMap.get(t.projectId);
    const overdue = t.status !== "done" && t.dueDate! < today;
    return (
      <button
        key={t.id}
        draggable={canEdit}
        onDragStart={(e) => {
          e.dataTransfer.setData("text/andamo-task", t.id);
          e.dataTransfer.effectAllowed = "move";
        }}
        onClick={() => open(t.id)}
        className={cn(
          "flex w-full items-center gap-1.5 truncate rounded-md border-l-[3px] bg-muted/60 px-1.5 py-1 text-left text-[11px] font-medium transition-colors hover:bg-accent",
          t.status === "done" && "text-muted-foreground line-through opacity-70",
          overdue && "bg-destructive/10 text-destructive",
          canEdit && "cursor-grab active:cursor-grabbing",
        )}
        style={{ borderLeftColor: p?.color ?? "hsl(var(--primary))" }}
        title={t.title}
      >
        {t.dueTime && <span className="tabular-nums text-muted-foreground">{t.dueTime}</span>}
        <span className="truncate">{t.title}</span>
      </button>
    );
  };

  const dayCell = (day: string, big = false) => {
    const list = byDay.get(day) ?? [];
    const inMonth = mode !== "month" || parse(day).getMonth() === month;
    return (
      <div
        key={day}
        onDragOver={(e) => {
          if (!canEdit) return;
          e.preventDefault();
          setDragOver(day);
        }}
        onDragLeave={() => setDragOver((d) => (d === day ? null : d))}
        onDrop={(e) => onDrop(e, day)}
        className={cn(
          "group relative flex min-h-28 flex-col gap-1 border-b border-r p-1.5 transition-colors",
          !inMonth && "bg-muted/30 text-muted-foreground",
          dragOver === day && "bg-primary/10 ring-2 ring-inset ring-primary",
          big && "min-h-[60vh]",
        )}
      >
        <div className="flex items-center justify-between">
          <span className={cn("flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold", day === today && "bg-primary text-primary-foreground")}>
            {parse(day).getDate()}
          </span>
          {can(ws.role, "tasks.create") && (
            <button onClick={() => setCreateOn(day)} className="rounded p-0.5 text-muted-foreground opacity-0 hover:bg-accent group-hover:opacity-100 focus-visible:opacity-100" aria-label={`Nova tarefa em ${parse(day).toLocaleDateString("pt-BR")}`}>
              <Plus className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="space-y-1">
          {(big ? list : list.slice(0, 3)).map(chip)}
          {!big && list.length > 3 && (
            <button className="text-[11px] font-medium text-primary hover:underline" onClick={() => (setMode("day"), setAnchor(day))}>
              +{list.length - 3} mais
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-6 sm:px-6 lg:py-8">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2">
          <h1 className="font-display text-2xl font-extrabold capitalize tracking-tight sm:text-3xl">{title}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-lg border">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => step(-1)} aria-label="Anterior"><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="ghost" size="sm" className="h-8" onClick={() => setAnchor(today)}>Hoje</Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => step(1)} aria-label="Próximo"><ChevronRight className="h-4 w-4" /></Button>
          </div>
          <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
            <TabsList>
              <TabsTrigger value="month">Mês</TabsTrigger>
              <TabsTrigger value="week">Semana</TabsTrigger>
              <TabsTrigger value="day">Dia</TabsTrigger>
              <TabsTrigger value="agenda">Agenda</TabsTrigger>
            </TabsList>
          </Tabs>
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger className="h-9 w-44" aria-label="Filtrar por projeto"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os projetos</SelectItem>
              {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-9" onClick={() => exportIcs(tasks.data ?? [], ws.name)} disabled={!tasks.data?.length}>
            <Download /> Exportar .ics
          </Button>
        </div>
      </div>
      {tasks.isError && <InlineError>{getErrorMessage(tasks.error)}</InlineError>}

      {mode === "agenda" ? (
        <div className="divide-y overflow-hidden rounded-xl border bg-card shadow-card">
          {days.filter((d) => byDay.get(d)?.length).map((d) => (
            <div key={d} className="flex gap-4 px-4 py-3">
              <div className={cn("w-20 shrink-0 text-sm", d === today && "font-bold text-primary")}>
                {parse(d).toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" })}
              </div>
              <div className="flex-1 space-y-1">{byDay.get(d)!.map(chip)}</div>
            </div>
          ))}
          {!days.some((d) => byDay.get(d)?.length) && <p className="p-6 text-sm text-muted-foreground">Nenhum prazo nos próximos 30 dias.</p>}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border-l border-t bg-card shadow-card">
          {mode !== "day" && (
            <div className="grid grid-cols-7 border-b bg-muted/30">
              {WEEKDAYS.map((w) => <div key={w} className="border-r px-2 py-1.5 text-xs font-medium text-muted-foreground">{w}</div>)}
            </div>
          )}
          <div className={cn("grid", mode === "day" ? "grid-cols-1" : "grid-cols-7")}>{days.map((d) => dayCell(d, mode === "day"))}</div>
        </div>
      )}
      <p className="text-xs text-muted-foreground">Arraste uma tarefa para outro dia para mudar o prazo. A integração com Google Agenda requer configuração de credenciais (veja o ROADMAP); enquanto isso, use a exportação .ics.</p>
      <QuickCreateDialog open={Boolean(createOn)} onOpenChange={(o) => !o && setCreateOn(null)} workspace={ws} defaultDueDate={createOn ?? undefined} defaultProjectId={projectId !== "all" ? projectId : undefined} />
    </div>
  );
}
