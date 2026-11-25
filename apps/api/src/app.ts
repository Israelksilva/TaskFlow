import { randomUUID } from "node:crypto";
import cors from "cors";
import express, { Router } from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { env } from "./config/env";
import { docsRoutes } from "./docs/docs.routes";
import { logger } from "./lib/logger";
import { errorHandler, notFoundHandler } from "./middlewares/error-handler";
import { globalLimiter } from "./middlewares/rate-limit";
import { authRoutes } from "./modules/auth/auth.routes";
import { contactRoutes } from "./modules/contact/contact.routes";
import { healthRoutes } from "./modules/health/health.routes";
import { taskRoutes } from "./modules/tasks/task.routes";

const REQUEST_ID = /^[\w-]{8,64}$/;

/** Rotas da API v1. Montadas em `/v1` e, por compatibilidade, na raiz. */
function apiRouter() {
  const router = Router();
  router.use("/auth", authRoutes);
  router.use("/tarefas", taskRoutes);
  router.use("/contato", contactRoutes);
  return router;
}

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", 1); // atrás do proxy do Render

  app.use(
    pinoHttp({
      logger,
      // Reaproveita o X-Request-Id do proxy quando válido; senão gera um.
      genReqId: (req, res) => {
        const incoming = req.headers["x-request-id"];
        const id =
          typeof incoming === "string" && REQUEST_ID.test(incoming) ? incoming : randomUUID();
        res.setHeader("X-Request-Id", id);
        return id;
      },
      customProps: (req) => ({ requestId: req.id }),
      autoLogging: { ignore: (req) => req.url?.startsWith("/health") ?? false },
    }),
  );
  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
      exposedHeaders: ["X-Request-Id"],
      maxAge: 600,
    }),
  );
  app.use(globalLimiter);
  app.use(express.json({ limit: "200kb" }));

  app.use("/health", healthRoutes);
  app.use("/v1", docsRoutes);
  app.use("/v1", apiRouter());
  // Aliases sem versão: mantêm o front atual e clientes antigos funcionando.
  app.use(apiRouter());

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
