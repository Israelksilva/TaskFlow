import cors from "cors";
import express from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { randomUUID } from "node:crypto";
import { env, integrations } from "./config/env";
import { db } from "./db";
import { buildOpenApi } from "./docs/openapi";
import { queueStats } from "./jobs/queue";
import { logger } from "./lib/logger";
import { errorHandler, notFoundHandler } from "./middlewares/error-handler";
import { authRoutes } from "./modules/auth/auth.routes";
import { notificationRoutes } from "./modules/notifications/notification.routes";
import { publicRoutes } from "./modules/public/public.routes";
import { legacyTaskRoutes } from "./modules/tasks/task.routes";
import { timerRoutes } from "./modules/time/time.routes";
import { workspaceRoutes } from "./modules/workspaces/workspace.routes";
import { connectedCount } from "./realtime/hub";
// Registra handlers de jobs e assinantes de eventos.
import "./modules/email/email.service";
import "./modules/notifications/reminders";
import "./modules/notifications/subscribers";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", 1); // atrás do proxy do Render

  app.use(
    helmet({
      // API JSON: nada de conteúdo ativo; HSTS é aplicado pelo Helmet em produção (HTTPS).
      contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
      exposedHeaders: ["X-Request-Id", "Location"],
      maxAge: 600,
    }),
  );
  app.use(express.json({ limit: "200kb" }));
  app.use(
    pinoHttp({
      logger,
      genReqId: (req, res) => {
        const incoming = req.headers["x-request-id"];
        const id = typeof incoming === "string" && /^[\w-]{8,64}$/.test(incoming) ? incoming : randomUUID();
        res.setHeader("X-Request-Id", id);
        return id;
      },
      autoLogging: { ignore: (req) => req.url?.startsWith("/health") ?? false },
    }),
  );

  /** Liveness (usado pelo health check do Render). */
  app.get("/health", async (_req, res) => {
    await db.query("SELECT 1");
    res.json({ status: "ok", uptime: Math.round(process.uptime()) });
  });

  /** Readiness/observabilidade: banco, fila de jobs, conexões em tempo real e integrações. */
  app.get("/health/ready", async (_req, res) => {
    const started = Date.now();
    await db.query("SELECT 1");
    res.json({
      status: "ok",
      dbLatencyMs: Date.now() - started,
      jobs: await queueStats(),
      realtimeConnections: connectedCount(),
      integrations,
    });
  });

  app.get("/v1/openapi.json", (_req, res) => res.json(buildOpenApi()));

  // API v1
  app.use("/v1", publicRoutes);
  app.use("/v1/auth", authRoutes);
  app.use("/v1/workspaces", workspaceRoutes);
  app.use("/v1/notificacoes", notificationRoutes);
  app.use("/v1/tempo", timerRoutes);

  // Rotas originais (compatibilidade com o cliente anterior)
  app.use("/auth", authRoutes);
  app.use("/tarefas", legacyTaskRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
