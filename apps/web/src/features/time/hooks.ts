import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { TimeEntry } from "@andamo/shared";
import { ApiError, getErrorMessage } from "@/lib/api-client";
import { timeApi } from "./api";

export const timeKeys = {
  running: ["timer", "running"] as const,
  all: (ws: string) => ["time", ws] as const,
};

export function useRunningTimer() {
  return useQuery({ queryKey: timeKeys.running, queryFn: timeApi.running, refetchInterval: 60_000 });
}

/** Segundos decorridos, atualizados a cada segundo enquanto o cronômetro roda. */
export function useElapsed(entry: TimeEntry | null | undefined): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!entry || entry.endedAt) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [entry]);
  if (!entry) return 0;
  return entry.endedAt ? entry.durationSeconds : Math.max(0, (now - new Date(entry.startedAt).getTime()) / 1000);
}

function useInvalidate(workspaceId?: string) {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: timeKeys.running });
    if (workspaceId) {
      void qc.invalidateQueries({ queryKey: timeKeys.all(workspaceId) });
      void qc.invalidateQueries({ queryKey: ["tasks", workspaceId] });
    }
  };
}

/** Iniciar/parar com troca confirmável quando já há outro cronômetro rodando. */
export function useTimerActions(workspaceId?: string) {
  const invalidate = useInvalidate(workspaceId);
  const start = useMutation({
    mutationFn: ({ ws, taskId, switchRunning }: { ws: string; taskId: string; switchRunning?: boolean }) => timeApi.start(ws, taskId, switchRunning),
    onSuccess: () => toast.success("Cronômetro iniciado"),
    onError: (error, vars) => {
      if (error instanceof ApiError && error.code === "TIMER_RUNNING") {
        toast.warning("Já existe um cronômetro rodando em outra tarefa", {
          action: { label: "Trocar para esta", onClick: () => start.mutate({ ...vars, switchRunning: true }) },
        });
      } else toast.error(getErrorMessage(error));
    },
    onSettled: invalidate,
  });
  const stop = useMutation({
    mutationFn: timeApi.stop,
    onSuccess: (entry) => entry && toast.success("Tempo registrado", { description: entry.taskTitle }),
    onError: (e) => toast.error(getErrorMessage(e)),
    onSettled: invalidate,
  });
  return { start, stop };
}
