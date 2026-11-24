import { afterAll, beforeAll } from "vitest";
import { db } from "../src/db";
import { migrate } from "../src/db/migrate";

// Aplica as mesmas migrações SQL de produção no Postgres em memória.
beforeAll(async () => {
  await migrate(db);
});

afterAll(async () => {
  await db.close();
});
