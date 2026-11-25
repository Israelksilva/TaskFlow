import { env } from "../config/env";
import { logger } from "../lib/logger";
import { claimJobs, completeJob, enqueue, failJob, type JobRow } from "./queue";

export type JobHandler = (payload: Record<string, unknown>, job: JobRow) => Promise<void>;

const handlers = new Map<string, JobHandler>();

/** Registra o handler de um tipo de job (feito pelos módulos na inicialização). */
export function registerJob(type: string, handler: JobHandler) {
  handlers.set(type, handler);
}

/** Tarefas periódicas: enfileiradas com dedupe por janela de tempo (uma execução por janela). */
interface Schedule {
  type: string;
  everyMinutes: number;
}
const schedules: Schedule[] = [];

export function registerSchedule(type: string, everyMinutes: number) {
  schedules.push({ type, everyMinutes });
}

async function enqueueSchedules(now = Date.now()) {
  for (const s of schedules) {
    const bucket = Math.floor(now / (s.everyMinutes * 60_000));
    await enqueue(s.type, {}, { dedupeKey: `schedule:${s.type}:${bucket}`, maxAttempts: 3 });
  }
}

/** Processa um lote de jobs vencidos. Retorna quantos foram processados. */
export async function runPendingJobs(limit = 20): Promise<number> {
  const jobs = await claimJobs(limit);
  for (const job of jobs) {
    const handler = handlers.get(job.type);
    try {
      if (!handler) throw new Error(`Nenhum handler para o job "${job.type}"`);
      await handler(job.payload, job);
      await completeJob(job.id);
    } catch (error) {
      logger.warn({ err: error, jobId: job.id, type: job.type, attempt: job.attempts }, "Job falhou");
      await failJob(job, error);
    }
  }
  return jobs.length;
}

let timer: NodeJS.Timeout | null = null;
let running: Promise<unknown> | null = null;

export function startWorker() {
  if (!env.WORKER_ENABLED || timer) return;
  const tick = async () => {
    try {
      await enqueueSchedules();
      // Esvazia a fila em lotes antes de dormir de novo.
      while ((await runPendingJobs()) > 0) {
        /* continua */
      }
    } catch (error) {
      logger.error({ err: error }, "Erro no worker de jobs");
    }
  };
  timer = setInterval(() => {
    if (!running) running = tick().finally(() => (running = null));
  }, env.WORKER_POLL_MS);
  timer.unref();
  logger.info(`Worker de jobs ativo (a cada ${env.WORKER_POLL_MS} ms)`);
}

/** Graceful shutdown: para de buscar jobs e aguarda o lote atual terminar. */
export async function stopWorker() {
  if (timer) clearInterval(timer);
  timer = null;
  await running;
}
