import { env, isTest } from "../config/env";
import { logger } from "./logger";

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}

export interface MailResult {
  status: "sent" | "skipped";
  id?: string;
}

/** Mensagens capturadas nos testes (inspecionáveis). */
export const sentMail: MailMessage[] = [];

/**
 * Envia e-mail pelo Resend (API HTTP). Sem RESEND_API_KEY não finge enviar:
 * registra no log e devolve `skipped` (o log de entrega guarda esse status).
 */
export async function sendMail(message: MailMessage): Promise<MailResult> {
  if (isTest) {
    sentMail.push(message);
    return { status: "sent", id: `test-${sentMail.length}` };
  }
  if (!env.RESEND_API_KEY) {
    logger.warn({ to: message.to, subject: message.subject }, "E-mail não enviado: RESEND_API_KEY não configurada");
    if (env.NODE_ENV === "development") logger.info({ text: message.text }, "Conteúdo do e-mail (dev)");
    return { status: "skipped" };
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [message.to],
      subject: message.subject,
      html: message.html,
      text: message.text,
      ...(message.replyTo && { reply_to: message.replyTo }),
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend respondeu ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = (await res.json().catch(() => ({}))) as { id?: string };
  return { status: "sent", id: data.id };
}
