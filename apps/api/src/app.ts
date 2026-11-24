import cors from "cors";
import express from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { env } from "./config/env";
import { db } from "./db";
import { logger } from "./lib/logger";
import { errorHandler, notFoundHandler } from "./middlewares/error-handler";
import { authRoutes } from "./modules/auth/auth.routes";
import { taskRoutes } from "./modules/tasks/task.routes";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", 1); // atrás do proxy do Render

  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
      maxAge: 600,
    }),
  );
  app.use(express.json({ limit: "200kb" }));
  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === "/health" } }));

  /** Usado pelo health check do Render. */
  app.get("/health", async (_req, res) => {
    await db.query("SELECT 1");
    res.json({ status: "ok", uptime: Math.round(process.uptime()) });
  });

  app.use("/auth", authRoutes);
  app.use("/tarefas", taskRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
