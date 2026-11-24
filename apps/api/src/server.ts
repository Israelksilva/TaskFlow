import { createApp } from "./app";
import { env } from "./config/env";
import { db } from "./db";
import { migrate } from "./db/migrate";
import { logger } from "./lib/logger";

// O Postgres embutido (PGlite) não tem etapa de deploy: migramos ao iniciar.
if (env.DATABASE_URL.startsWith("pglite://")) {
  const applied = await migrate(db);
  if (applied.length) logger.info(`Migrações aplicadas: ${applied.join(", ")}`);
}

const app = createApp();

// Render (e outros PaaS) definem PORT; o Node escuta em todas as interfaces por padrão.
const server = app.listen(env.PORT, () => {
  logger.info(`🚀 Andamo API em http://localhost:${env.PORT} (${env.NODE_ENV})`);
});

function shutdown(signal: string) {
  logger.info(`${signal} recebido, encerrando...`);
  server.close(async () => {
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
