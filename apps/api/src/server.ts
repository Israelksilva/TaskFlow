import { createServer } from "node:http";
import { createApp } from "./app";
import { env } from "./config/env";
import { db } from "./db";
import { migrate } from "./db/migrate";
import { startWorker, stopWorker } from "./jobs/worker";
import { logger } from "./lib/logger";
import { attachRealtime } from "./realtime/hub";

// O Postgres embutido (PGlite) não tem etapa de deploy: migramos ao iniciar.
if (env.DATABASE_URL.startsWith("pglite://")) {
  const applied = await migrate(db);
  if (applied.length) logger.info(`Migrações aplicadas: ${applied.join(", ")}`);
}

const server = createServer(createApp());
const realtime = attachRealtime(server);

// Render (e outros PaaS) definem PORT; o Node escuta em todas as interfaces por padrão.
server.listen(env.PORT, () => {
  logger.info(`🚀 Andamo API em http://localhost:${env.PORT} (${env.NODE_ENV})`);
  startWorker();
});

let shuttingDown = false;

/** Graceful shutdown: para de aceitar conexões, conclui jobs em andamento e fecha o banco. */
function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`${signal} recebido, encerrando...`);
  realtime.close();
  server.close(async () => {
    await stopWorker();
    await db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("unhandledRejection", (reason) => {
  logger.fatal({ err: reason }, "unhandledRejection");
  process.exit(1);
});
