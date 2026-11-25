import type { IncomingMessage, Server } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import { env } from "../config/env";
import { db } from "../db";
import { logger } from "../lib/logger";
import { resolveAuth } from "../middlewares/authenticate";

/**
 * Tempo real via WebSocket em `/v1/realtime`.
 * Autenticação: o access token vai no subprotocolo (`new WebSocket(url, ["andamo", token])`),
 * evitando tokens na URL (que acabariam em logs).
 * Escopo: instância única (o plano atual do Render). Para várias instâncias, troque o
 * `broadcast` local por Postgres LISTEN/NOTIFY ou Redis pub/sub — a interface não muda.
 */
export interface RealtimeMessage {
  type: string;
  [key: string]: unknown;
}

interface Client {
  socket: WebSocket;
  userId: string;
  workspaces: Set<string>;
  /** Tarefa aberta no momento (indicador de presença). */
  viewing: string | null;
  alive: boolean;
}

const clients = new Set<Client>();

function send(client: Client, message: RealtimeMessage) {
  if (client.socket.readyState === client.socket.OPEN) client.socket.send(JSON.stringify(message));
}

export function publishToUser(userId: string, message: RealtimeMessage) {
  for (const c of clients) if (c.userId === userId) send(c, message);
}

export function publishToWorkspace(workspaceId: string, message: RealtimeMessage, exceptUserId?: string) {
  for (const c of clients) {
    if (c.workspaces.has(workspaceId) && c.userId !== exceptUserId) send(c, { ...message, workspaceId });
  }
}

/** Quem está vendo a tarefa agora (ids de usuário, sem repetição). */
function viewersOf(taskId: string): string[] {
  return [...new Set([...clients].filter((c) => c.viewing === taskId).map((c) => c.userId))];
}

function broadcastPresence(taskId: string, workspaces: Set<string>) {
  const message = { type: "presence", taskId, userIds: viewersOf(taskId) };
  for (const ws of workspaces) publishToWorkspace(ws, message);
}

/** Presença só vale para tarefas de workspaces dos quais o usuário é membro (sem vazar entre tenants). */
async function updatePresence(client: Client, taskId: unknown) {
  const previous = client.viewing;
  let next: string | null = null;
  if (typeof taskId === "string" && /^[0-9a-f-]{36}$/i.test(taskId)) {
    const { rows } = await db.query<{ workspace_id: string }>(`SELECT workspace_id FROM tasks WHERE id = $1`, [taskId]);
    if (rows[0] && client.workspaces.has(rows[0].workspace_id)) next = taskId;
  }
  client.viewing = next;
  if (previous && previous !== next) broadcastPresence(previous, client.workspaces);
  if (next) broadcastPresence(next, client.workspaces);
}

/** Atualiza a lista de workspaces de um usuário conectado (ex.: aceitou um convite). */
export async function refreshUserWorkspaces(userId: string) {
  const { rows } = await db.query<{ workspace_id: string }>(
    `SELECT workspace_id FROM workspace_members WHERE user_id = $1`,
    [userId],
  );
  for (const c of clients) if (c.userId === userId) c.workspaces = new Set(rows.map((r) => r.workspace_id));
}

export function connectedCount() {
  return clients.size;
}

export function attachRealtime(server: Server) {
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: 16 * 1024,
    handleProtocols: (protocols) => (protocols.has("andamo") ? "andamo" : false),
  });

  server.on("upgrade", (req: IncomingMessage, socket, head) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const origin = req.headers.origin;
    if (url.pathname !== "/v1/realtime" || (origin && !env.CORS_ORIGIN.includes(origin))) {
      socket.destroy();
      return;
    }
    const protocols = (req.headers["sec-websocket-protocol"] ?? "").split(",").map((p) => p.trim());
    const token = protocols.find((p) => p !== "andamo");
    if (!token) {
      socket.destroy();
      return;
    }
    resolveAuth(token)
      .then(async (auth) => {
        const { rows } = await db.query<{ workspace_id: string }>(
          `SELECT workspace_id FROM workspace_members WHERE user_id = $1`,
          [auth.userId],
        );
        wss.handleUpgrade(req, socket, head, (ws) => {
          const client: Client = {
            socket: ws,
            userId: auth.userId,
            workspaces: new Set(rows.map((r) => r.workspace_id)),
            viewing: null,
            alive: true,
          };
          clients.add(client);
          send(client, { type: "hello", userId: auth.userId });

          ws.on("pong", () => (client.alive = true));
          ws.on("message", (raw) => {
            try {
              const msg = JSON.parse(String(raw)) as { type?: string; taskId?: unknown };
              if (msg.type === "ping") send(client, { type: "pong" });
              if (msg.type === "presence") void updatePresence(client, msg.taskId);
            } catch {
              /* mensagem inválida: ignorada */
            }
          });
          ws.on("close", () => {
            clients.delete(client);
            if (client.viewing) broadcastPresence(client.viewing, client.workspaces);
          });
        });
      })
      .catch(() => socket.destroy());
  });

  // Heartbeat: derruba conexões mortas (o cliente reconecta sozinho).
  const interval = setInterval(() => {
    for (const c of clients) {
      if (!c.alive) {
        c.socket.terminate();
        clients.delete(c);
        continue;
      }
      c.alive = false;
      c.socket.ping();
    }
  }, 30_000);
  interval.unref();

  logger.info("Tempo real (WebSocket) ativo em /v1/realtime");
  return {
    close() {
      clearInterval(interval);
      for (const c of clients) c.socket.close(1001, "Servidor reiniciando");
      wss.close();
    },
  };
}
