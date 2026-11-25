import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { AppNotification } from "@andamo/shared";
import { env } from "@/config/env";
import { refreshSession } from "@/lib/api-client";
import { tokenStorage } from "@/lib/storage";
import { notificationKeys } from "../notifications/hooks";
import { wsKeys } from "../workspaces/hooks";

type Status = "connecting" | "online" | "offline";

interface Message {
  type: string;
  workspaceId?: string;
  projectId?: string;
  taskId?: string;
  userIds?: string[];
  notification?: AppNotification;
  sound?: boolean;
}

/** Converte a URL da API (http/https, absoluta ou relativa) em ws/wss. */
function realtimeUrl(): string {
  const base = new URL(env.apiUrl, window.location.origin);
  base.protocol = base.protocol === "https:" ? "wss:" : "ws:";
  return `${base.toString().replace(/\/$/, "")}/v1/realtime`;
}

/** Som curto gerado no navegador (sem arquivo externo), só se o usuário habilitou. */
function playChime() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch {
    /* áudio indisponível */
  }
}

const presenceListeners = new Set<(taskId: string, userIds: string[]) => void>();
let activeSocket: WebSocket | null = null;

/** Indicador de presença: informa a tarefa aberta e recebe quem mais está vendo. */
export function sendPresence(taskId: string | null) {
  if (activeSocket?.readyState === WebSocket.OPEN) activeSocket.send(JSON.stringify({ type: "presence", taskId }));
}
export function onPresence(listener: (taskId: string, userIds: string[]) => void) {
  presenceListeners.add(listener);
  return () => void presenceListeners.delete(listener);
}

/**
 * Conexão em tempo real: invalida as consultas afetadas por eventos de outras pessoas
 * e mostra toasts de novas notificações. Reconecta com backoff exponencial e
 * renova o access token quando necessário.
 */
export function useRealtime(enabled: boolean, onOpenNotification: (n: AppNotification) => void) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<Status>("connecting");
  const openRef = useRef(onOpenNotification);
  openRef.current = onOpenNotification;

  useEffect(() => {
    if (!enabled) return;
    let socket: WebSocket | null = null;
    let attempts = 0;
    let timer: number | undefined;
    let closed = false;

    const handle = (msg: Message) => {
      switch (msg.type) {
        case "notification":
          void qc.invalidateQueries({ queryKey: notificationKeys.all });
          if (msg.notification) {
            const n = msg.notification;
            if (msg.sound) playChime();
            toast(n.title, {
              description: n.body ?? undefined,
              action: n.link ? { label: "Abrir", onClick: () => openRef.current(n) } : undefined,
            });
          }
          break;
        case "notification.read":
          void qc.invalidateQueries({ queryKey: notificationKeys.all });
          break;
        case "task.changed":
        case "comments.changed":
          if (msg.workspaceId) {
            void qc.invalidateQueries({ queryKey: ["tasks", msg.workspaceId] });
            void qc.invalidateQueries({ queryKey: wsKeys.dashboard(msg.workspaceId) });
            void qc.invalidateQueries({ queryKey: ["workspaces", msg.workspaceId, "projects"] });
          }
          break;
        case "project.changed":
          if (msg.workspaceId) void qc.invalidateQueries({ queryKey: ["workspaces", msg.workspaceId] });
          break;
        case "members.changed":
          if (msg.workspaceId) void qc.invalidateQueries({ queryKey: wsKeys.members(msg.workspaceId) });
          break;
        case "workspaces.changed":
          void qc.invalidateQueries({ queryKey: wsKeys.all });
          break;
        case "timer.changed":
          // Cronômetro iniciado/parado em outro dispositivo.
          void qc.invalidateQueries({ queryKey: ["timer"] });
          void qc.invalidateQueries({ queryKey: ["time"] });
          break;
        case "presence":
          if (msg.taskId) for (const l of presenceListeners) l(msg.taskId, msg.userIds ?? []);
          break;
      }
    };

    const connect = async () => {
      if (closed) return;
      const token = tokenStorage.get();
      if (!token) return;
      setStatus("connecting");
      try {
        socket = new WebSocket(realtimeUrl(), ["andamo", token]);
      } catch {
        schedule();
        return;
      }
      activeSocket = socket;
      socket.onopen = () => {
        attempts = 0;
        setStatus("online");
        // Ao reconectar, sincroniza o que pode ter mudado enquanto esteve fora.
        void qc.invalidateQueries({ queryKey: notificationKeys.all });
        void qc.invalidateQueries({ queryKey: ["tasks"] });
      };
      socket.onmessage = (e) => {
        try {
          handle(JSON.parse(String(e.data)) as Message);
        } catch {
          /* mensagem inválida */
        }
      };
      socket.onclose = () => {
        if (activeSocket === socket) activeSocket = null;
        setStatus("offline");
        schedule();
      };
    };

    const schedule = () => {
      if (closed) return;
      attempts += 1;
      const delay = Math.min(30_000, 1000 * 2 ** Math.min(attempts, 5)) + Math.random() * 500;
      timer = window.setTimeout(async () => {
        // O token pode ter expirado enquanto estava desconectado.
        if (attempts > 1) await refreshSession();
        void connect();
      }, delay);
    };

    const onOnline = () => {
      if (!socket || socket.readyState === WebSocket.CLOSED) {
        window.clearTimeout(timer);
        attempts = 0;
        void connect();
      }
    };
    window.addEventListener("online", onOnline);
    void connect();

    return () => {
      closed = true;
      window.clearTimeout(timer);
      window.removeEventListener("online", onOnline);
      socket?.close();
      activeSocket = null;
    };
  }, [enabled, qc]);

  return status;
}
