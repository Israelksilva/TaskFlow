import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pause, Play, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { can, toISODate, type Task, type Workspace } from "@andamo/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/features/auth/use-auth";
import { getErrorMessage } from "@/lib/api-client";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { formatClock, formatDuration, timeApi } from "../api";
import { timeKeys, useElapsed, useRunningTimer, useTimerActions } from "../hooks";

function localNowInput() {
  const d = new Date(Date.now() - 60 * 60 * 1000);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

/** Controle de tempo da tarefa: cronômetro, estimado × realizado, registro manual e histórico. */
export function TaskTimeSection({ task, workspace }: { task: Task; workspace: Workspace }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const running = useRunningTimer().data;
  const runningHere = running?.taskId === task.id ? running : null;
  const elapsed = useElapsed(runningHere);
  const { start, stop } = useTimerActions(workspace.id);
  const [manualOpen, setManualOpen] = useState(false);
  const [when, setWhen] = useState(localNowInput);
  const [minutes, setMinutes] = useState("30");
  const [note, setNote] = useState("");
  const canTrack = !task.deletedAt && (can(workspace.role, "tasks.edit") || (can(workspace.role, "tasks.editAssigned") && task.assigneeIds.includes(user!.id)));

  const query = { from: "2000-01-01", to: toISODate(new Date(Date.now() + 864e5)), taskId: task.id };
  const entries = useQuery({ queryKey: [...timeKeys.all(workspace.id), "task", task.id], queryFn: () => timeApi.list(workspace.id, query) });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: timeKeys.all(workspace.id) });
    void qc.invalidateQueries({ queryKey: ["tasks", workspace.id] });
  };
  const addManual = useMutation({
    mutationFn: () => timeApi.addManual(workspace.id, task.id, { startedAt: new Date(when).toISOString(), minutes: Math.round(Number(minutes)), note }),
    onSuccess: () => {
      toast.success("Tempo registrado");
      setManualOpen(false);
      setNote("");
      refresh();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
  const remove = useMutation({ mutationFn: (id: string) => timeApi.remove(workspace.id, id), onSuccess: refresh, onError: (e) => toast.error(getErrorMessage(e)) });

  // O total vem da tarefa (servidor) e soma o trecho em andamento ao vivo.
  const tracked = task.trackedSeconds - (runningHere ? runningHere.durationSeconds : 0) + (runningHere ? elapsed : 0);
  const estimate = task.estimateMinutes ? task.estimateMinutes * 60 : null;
  const pct = estimate ? Math.min(100, Math.round((tracked / estimate) * 100)) : null;
  const over = estimate !== null && tracked > estimate;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!addManual.isPending && Number(minutes) >= 1) addManual.mutate();
  };

  return (
    <section aria-labelledby="time-h" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="time-h" className="text-sm font-semibold">
          Tempo
        </h3>
        {canTrack && (
          <div className="flex gap-2">
            {runningHere ? (
              <Button size="sm" variant="outline" className="h-8 border-coral/50 text-coral" onClick={() => stop.mutate()} disabled={stop.isPending}>
                <Pause /> Pausar <span className="font-mono tabular-nums">{formatClock(elapsed)}</span>
              </Button>
            ) : (
              <Button size="sm" className="h-8" onClick={() => start.mutate({ ws: workspace.id, taskId: task.id })} disabled={start.isPending}>
                <Play /> {task.trackedSeconds > 0 ? "Retomar" : "Iniciar"} cronômetro
              </Button>
            )}
            <Button size="sm" variant="ghost" className="h-8" onClick={() => setManualOpen((o) => !o)} aria-expanded={manualOpen}>
              <Plus /> Registrar manualmente
            </Button>
          </div>
        )}
      </div>

      <div className="rounded-lg border bg-muted/30 p-3">
        <div className="flex items-baseline justify-between text-sm">
          <span>
            <span className="font-semibold tabular-nums">{formatDuration(tracked)}</span> <span className="text-muted-foreground">realizado</span>
          </span>
          <span className="text-muted-foreground">{estimate ? `estimado ${formatDuration(estimate)}` : "sem estimativa"}</span>
        </div>
        {pct !== null && (
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Realizado em relação ao estimado">
            <div className={cn("h-full rounded-full", over ? "bg-destructive" : "bg-brand")} style={{ width: `${pct}%` }} />
          </div>
        )}
        {over && <p className="mt-1 text-xs font-medium text-destructive">Acima da estimativa em {formatDuration(tracked - estimate!)}.</p>}
      </div>

      {manualOpen && (
        <form onSubmit={submit} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_7rem]">
          <div className="space-y-1">
            <Label htmlFor="tm-when" className="text-xs">Início</Label>
            <Input id="tm-when" type="datetime-local" value={when} max={localNowInput()} onChange={(e) => setWhen(e.target.value)} className="h-8" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="tm-min" className="text-xs">Minutos</Label>
            <Input id="tm-min" type="number" min={1} max={1440} value={minutes} onChange={(e) => setMinutes(e.target.value)} className="h-8" />
          </div>
          <Input aria-label="Observação" placeholder="Observação (opcional)" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} className="h-8 sm:col-span-2" />
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setManualOpen(false)}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={addManual.isPending || Number(minutes) < 1}>Salvar</Button>
          </div>
        </form>
      )}

      {(entries.data?.length ?? 0) > 0 && (
        <ul className="divide-y rounded-lg border text-sm">
          {entries.data!.slice(0, 8).map((e) => (
            <li key={e.id} className="flex items-center gap-2 px-3 py-2">
              <span className="w-16 shrink-0 font-medium tabular-nums">{e.endedAt ? formatDuration(e.durationSeconds) : "rodando"}</span>
              <span className="min-w-0 flex-1 truncate text-muted-foreground">
                {e.user.name.split(" ")[0]} · {relativeTime(e.startedAt)}
                {e.source === "manual" && " · manual"}
                {e.note && ` · ${e.note}`}
              </span>
              {e.endedAt && (e.user.id === user?.id || can(workspace.role, "projects.manage")) && (
                <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Excluir registro de tempo" onClick={() => remove.mutate(e.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
