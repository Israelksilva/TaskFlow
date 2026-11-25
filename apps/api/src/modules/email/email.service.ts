import { db as defaultDb, type Queryable } from "../../db";
import { enqueue } from "../../jobs/queue";
import { registerJob } from "../../jobs/worker";
import { sendMail } from "../../lib/mailer";
import { logger } from "../../lib/logger";
import type { RenderedEmail } from "./templates";

/**
 * Log de entrega tolerante: a notificação pode ter sido excluída pelo usuário antes do envio
 * (gravamos sem o vínculo) e falhas aqui são só registradas.
 */
export async function logDelivery(
  notificationId: string | null,
  userId: string | null,
  channel: "push" | "email",
  status: "sent" | "failed" | "skipped",
  detail: string | null,
): Promise<void> {
  try {
    await defaultDb.query(
      `INSERT INTO delivery_logs (notification_id, user_id, channel, status, detail)
       VALUES ((SELECT id FROM notifications WHERE id = $1), (SELECT id FROM users WHERE id = $2), $3, $4, $5)`,
      [notificationId, userId, channel, status, detail],
    );
  } catch (error) {
    logger.warn({ err: error }, "Falha ao registrar log de entrega");
  }
}

/**
 * E-mails saem pela fila (retry automático). O conteúdo do job é apagado ao concluir,
 * para que links de uso único não fiquem guardados no banco.
 */
export async function queueEmail(
  to: string,
  email: RenderedEmail,
  meta: { userId?: string; notificationId?: string; dedupeKey?: string } = {},
  db: Queryable = defaultDb,
): Promise<void> {
  await enqueue(
    "email.send",
    { to, ...email, userId: meta.userId ?? null, notificationId: meta.notificationId ?? null },
    { dedupeKey: meta.dedupeKey, maxAttempts: 5 },
    db,
  );
}

registerJob("email.send", async (payload, job) => {
  const p = payload as { to: string; subject: string; html: string; text: string; userId: string | null; notificationId: string | null };
  let status: "sent" | "skipped" | "failed" = "failed";
  let detail: string | null = null;
  try {
    const result = await sendMail({ to: p.to, subject: p.subject, html: p.html, text: p.text });
    status = result.status;
    detail = result.status === "skipped" ? "Provedor de e-mail não configurado" : (result.id ?? null);
  } catch (error) {
    detail = error instanceof Error ? error.message.slice(0, 500) : "erro";
    throw error;
  } finally {
    // Registrar o log nunca pode reprocessar (e duplicar) um e-mail já enviado.
    await logDelivery(p.notificationId, p.userId, "email", status, detail);
    if (status !== "failed") await defaultDb.query(`UPDATE jobs SET payload = '{}'::jsonb WHERE id = $1`, [job.id]);
  }
});
