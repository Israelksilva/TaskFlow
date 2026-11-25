import { db as defaultDb, type Queryable } from "../db";

/**
 * Fila durável sobre o PostgreSQL (sem Redis): adequada ao Neon + Render.
 * - `dedupeKey` torna o enfileiramento idempotente (mesma chave = mesmo job);
 * - jobs agendados usam `runAt` e sobrevivem a reinícios (nada de timers em memória);
 * - o worker busca com `FOR UPDATE SKIP LOCKED`, permitindo várias instâncias.
 */
export interface EnqueueOptions {
  runAt?: Date;
  dedupeKey?: string;
  maxAttempts?: number;
}

export interface JobRow {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  attempts: number;
  max_attempts: number;
}

export async function enqueue(
  type: string,
  payload: Record<string, unknown>,
  options: EnqueueOptions = {},
  db: Queryable = defaultDb,
): Promise<boolean> {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO jobs (type, payload, run_at, max_attempts, dedupe_key)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (dedupe_key) DO NOTHING
     RETURNING id`,
    [type, JSON.stringify(payload), options.runAt ?? new Date(), options.maxAttempts ?? 5, options.dedupeKey ?? null],
  );
  return rows.length > 0;
}

/**
 * Cancela jobs pendentes cujo dedupe_key começa com o prefixo (ex.: lembretes de uma tarefa)
 * e libera a chave, para que o mesmo job possa ser reagendado depois.
 */
export async function cancelPending(prefix: string, db: Queryable = defaultDb): Promise<void> {
  await db.query(
    `UPDATE jobs SET status = 'cancelled', finished_at = now(), dedupe_key = NULL
     WHERE status = 'pending' AND dedupe_key LIKE $1`,
    [`${prefix.replace(/[%_]/g, "\\$&")}%`],
  );
}

/** Reserva até `limit` jobs vencidos. Jobs "running" há mais de 5 min são considerados travados. */
export async function claimJobs(limit: number, db: Queryable = defaultDb): Promise<JobRow[]> {
  const { rows } = await db.query<JobRow>(
    `UPDATE jobs SET status = 'running', locked_at = now(), attempts = attempts + 1
     WHERE id IN (
       SELECT id FROM jobs
       WHERE (status = 'pending' AND run_at <= now())
          OR (status = 'running' AND locked_at < now() - interval '5 minutes')
       ORDER BY run_at
       LIMIT $1
       FOR UPDATE SKIP LOCKED
     )
     RETURNING id::text AS id, type, payload, attempts, max_attempts`,
    [limit],
  );
  return rows;
}

export async function completeJob(id: string, db: Queryable = defaultDb): Promise<void> {
  await db.query(`UPDATE jobs SET status = 'done', finished_at = now(), locked_at = NULL WHERE id = $1`, [id]);
}

/** Retry com backoff exponencial (30s, 2min, 8min…); após o limite, marca como `failed`. */
export async function failJob(job: JobRow, error: unknown, db: Queryable = defaultDb): Promise<void> {
  const message = (error instanceof Error ? error.message : String(error)).slice(0, 1000);
  const exhausted = job.attempts >= job.max_attempts;
  const delaySeconds = 30 * 4 ** (job.attempts - 1);
  await db.query(
    exhausted
      ? `UPDATE jobs SET status = 'failed', last_error = $2, locked_at = NULL, finished_at = now() WHERE id = $1`
      : `UPDATE jobs SET status = 'pending', last_error = $2, locked_at = NULL,
           run_at = now() + make_interval(secs => $3::double precision) WHERE id = $1`,
    exhausted ? [job.id, message] : [job.id, message, delaySeconds],
  );
}

export async function queueStats(db: Queryable = defaultDb) {
  const { rows } = await db.query<{ status: string; count: number }>(
    `SELECT status, count(*)::int AS count FROM jobs
     WHERE status IN ('pending', 'running') OR finished_at > now() - interval '24 hours'
     GROUP BY status`,
  );
  return Object.fromEntries(rows.map((r) => [r.status, r.count])) as Record<string, number>;
}
