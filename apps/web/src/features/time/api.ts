import type { ManualTimeInput, TimeEntry, TimeQuery, TimeSummary, UpdateTimeEntryInput } from "@andamo/shared";
import { apiRequest } from "@/lib/api-client";

const ws = (id: string) => `/v1/workspaces/${id}`;

export const timeApi = {
  running: () => apiRequest<{ entry: TimeEntry | null }>("/v1/tempo/ativo").then((r) => r.entry),
  stop: () => apiRequest<{ entry: TimeEntry | null }>("/v1/tempo/parar", { method: "POST" }).then((r) => r.entry),
  start: (workspaceId: string, taskId: string, switchRunning = false) =>
    apiRequest<{ entry: TimeEntry }>(`${ws(workspaceId)}/tarefas/${taskId}/tempo/iniciar`, { method: "POST", body: { switch: switchRunning } }).then(
      (r) => r.entry,
    ),
  addManual: (workspaceId: string, taskId: string, input: ManualTimeInput) =>
    apiRequest<{ entry: TimeEntry }>(`${ws(workspaceId)}/tarefas/${taskId}/tempo`, { method: "POST", body: input }).then((r) => r.entry),
  update: (workspaceId: string, id: string, input: UpdateTimeEntryInput) =>
    apiRequest<{ entry: TimeEntry }>(`${ws(workspaceId)}/tempo/${id}`, { method: "PATCH", body: input }).then((r) => r.entry),
  remove: (workspaceId: string, id: string) => apiRequest<void>(`${ws(workspaceId)}/tempo/${id}`, { method: "DELETE" }),
  list: (workspaceId: string, q: TimeQuery) =>
    apiRequest<{ entries: TimeEntry[] }>(`${ws(workspaceId)}/tempo`, { query: { ...q } }).then((r) => r.entries),
  summary: (workspaceId: string, q: TimeQuery) => apiRequest<TimeSummary>(`${ws(workspaceId)}/tempo/resumo`, { query: { ...q } }),
};

/** "1h 25min", "45min", "30s". */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h) return `${h}h${m ? ` ${m}min` : ""}`;
  if (m) return `${m}min`;
  return `${s}s`;
}

/** Relógio "01:05:09" para o cronômetro em andamento. */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((n) => String(n).padStart(2, "0")).join(":");
}
