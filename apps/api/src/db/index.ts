import { env } from "../config/env";
import { createDatabase } from "./database";

export type { Database, Queryable } from "./database";

/** Instância única do banco para a aplicação. */
export const db = createDatabase(env.DATABASE_URL);
