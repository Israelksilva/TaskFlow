import * as webpush from "web-push";
import { env, integrations, isTest } from "../config/env";

if (integrations.push) {
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY!, env.VAPID_PRIVATE_KEY!);
}

export interface PushTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export type PushOutcome = "sent" | "expired" | "failed" | "disabled";

/** Notificações enviadas nos testes (inspecionáveis). */
export const sentPushes: Array<{ endpoint: string; payload: unknown }> = [];

/**
 * Envia um Web Push (VAPID). `expired` = inscrição inválida (404/410) e deve ser removida.
 * Sem chaves VAPID configuradas, retorna `disabled` — nunca finge ter enviado.
 */
export async function sendPush(target: PushTarget, payload: Record<string, unknown>): Promise<PushOutcome> {
  if (isTest) {
    sentPushes.push({ endpoint: target.endpoint, payload });
    return target.endpoint.includes("expired") ? "expired" : "sent";
  }
  if (!integrations.push) return "disabled";
  try {
    await webpush.sendNotification(
      { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
      JSON.stringify(payload),
      { TTL: 60 * 60 * 24, urgency: "normal", timeout: 10_000 },
    );
    return "sent";
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode;
    return status === 404 || status === 410 ? "expired" : "failed";
  }
}
