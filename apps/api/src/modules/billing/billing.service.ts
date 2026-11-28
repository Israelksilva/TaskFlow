import { PLANS, type BillingInfo, type PlanId, type Subscription } from "@andamo/shared";
import { env, integrations } from "../../config/env";
import { db } from "../../db";
import { registerJob, registerSchedule } from "../../jobs/worker";
import { logger } from "../../lib/logger";
import { mercadoPago, PaymentsUnavailableError, type MpPreapproval } from "../../lib/mercadopago";
import { toISO } from "../../shared/dates";
import { AppError, BadRequestError, ConflictError, NotFoundError } from "../../shared/errors";
import { audit } from "../audit/audit";
import { notificationService } from "../notifications/notification.service";

interface SubRow {
  id: string;
  workspace_id: string;
  provider_id: string | null;
  plan: "pro" | "business";
  status: Subscription["status"];
  amount_cents: number;
  payer_email: string;
  test_mode: boolean;
  next_payment_at: Date | string | null;
  ends_at: Date | string | null;
  cancelled_at: Date | string | null;
  created_at: Date | string;
}

const iso = (v: Date | string | null) => (v ? toISO(v) : null);
const toDTO = (r: SubRow): Subscription => ({
  id: r.id, plan: r.plan, status: r.status, amountCents: r.amount_cents, payerEmail: r.payer_email, testMode: r.test_mode,
  nextPaymentAt: iso(r.next_payment_at), endsAt: iso(r.ends_at), cancelledAt: iso(r.cancelled_at), createdAt: toISO(r.created_at),
});

async function latest(workspaceId: string): Promise<SubRow | null> {
  const { rows } = await db.query<SubRow>(`SELECT * FROM subscriptions WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT 1`, [workspaceId]);
  return rows[0] ?? null;
}

async function ownerOf(workspaceId: string) {
  const { rows } = await db.query<{ owner_id: string; name: string; plan: PlanId }>(`SELECT owner_id, name, plan FROM workspaces WHERE id = $1`, [workspaceId]);
  return rows[0];
}

async function setPlan(workspaceId: string, plan: PlanId, reason: string, subscriptionId: string) {
  const ws = await ownerOf(workspaceId);
  if (!ws || ws.plan === plan) return;
  await db.query(`UPDATE workspaces SET plan = $2, updated_at = now() WHERE id = $1`, [workspaceId, plan]);
  await audit({ actorId: null, workspaceId, action: "billing.plan_changed", target: workspaceId, data: { from: ws.plan, to: plan, reason, subscriptionId } });
  await notificationService.notify({
    userIds: [ws.owner_id], workspaceId, type: "plan.changed", category: "system",
    title: plan === "free" ? `${ws.name} voltou ao plano Free` : `${ws.name} agora está no plano ${PLANS[plan].name}`,
    link: `/app/w/${workspaceId}/planos`, dedupeKey: `plan:${workspaceId}:${plan}:${subscriptionId}`,
  });
}

/** Aplica o estado do Mercado Pago (fonte da verdade) à assinatura local e ao plano do workspace. */
async function applyProviderState(sub: SubRow, mp: MpPreapproval): Promise<SubRow> {
  // Proteção contra adulteração: valor e referência precisam bater com o que criamos.
  const amount = Math.round((mp.auto_recurring?.transaction_amount ?? 0) * 100);
  if (mp.external_reference !== sub.id || amount !== sub.amount_cents || mp.auto_recurring?.currency_id !== "BRL") {
    logger.error({ subscriptionId: sub.id }, "Assinatura do Mercado Pago não confere com a local — ignorada");
    throw new BadRequestError("Os dados da assinatura no Mercado Pago não conferem com o pedido.", "SUBSCRIPTION_MISMATCH");
  }
  const next = mp.next_payment_date ? new Date(mp.next_payment_date) : null;
  const status = mp.status;
  const { rows } = await db.query<SubRow>(
    `UPDATE subscriptions SET status = $2::varchar, provider_id = COALESCE(provider_id, $3::varchar), next_payment_at = $4::timestamptz,
       cancelled_at = CASE WHEN $2::varchar = 'cancelled' THEN COALESCE(cancelled_at, now()) ELSE cancelled_at END,
       -- Fim do ciclo pago: data do provedor ou, se ele não informar após o cancelamento, a última salva aqui.
       ends_at = CASE WHEN $2::varchar = 'cancelled' THEN COALESCE(ends_at, GREATEST(COALESCE($4::timestamptz, next_payment_at, now()), now())) ELSE ends_at END,
       updated_at = now()
     WHERE id = $1 RETURNING *`,
    [sub.id, status, mp.id, next],
  );
  const updated = rows[0];
  if (status === "authorized") await setPlan(sub.workspace_id, sub.plan, "Assinatura autorizada (Mercado Pago, teste)", sub.id);
  if (status === "paused") await setPlan(sub.workspace_id, "free", "Assinatura pausada no Mercado Pago", sub.id);
  if (status === "cancelled" && sub.status === "pending") {
    // Nunca foi paga: nada a manter.
    await db.query(`UPDATE subscriptions SET ends_at = now() WHERE id = $1`, [sub.id]);
  }
  return updated;
}

/**
 * Página de retorno do checkout: precisa ser HTTPS público (o Mercado Pago recusa localhost e URLs com "#").
 * Ela só reconduz o comprador ao app; quem ativa o plano é a confirmação do Mercado Pago (webhook/consulta).
 */
export function returnUrl(workspaceId: string): string {
  const base = env.PUBLIC_API_URL?.replace(/\/$/, "");
  if (!base || !base.startsWith("https://")) {
    throw new PaymentsUnavailableError(
      "PUBLIC_API_URL_REQUIRED",
      "Defina PUBLIC_API_URL com o endereço HTTPS público da API (no teste local, abra o túnel do ngrok antes de iniciar a API).",
    );
  }
  return `${base}/v1/pagamentos/retorno/${workspaceId}`;
}

export const billingService = {
  async info(workspaceId: string): Promise<BillingInfo> {
    const sub = await latest(workspaceId);
    return { available: integrations.payments, testMode: true, subscription: sub ? toDTO(sub) : null };
  },

  /** Cria a assinatura no Mercado Pago (modo teste) e devolve o link de checkout. */
  async checkout(ctx: { workspaceId: string; userId: string; ip: string | null }, input: { plan: "pro" | "business"; payerEmail: string }) {
    const current = await latest(ctx.workspaceId);
    if (current?.status === "authorized" || current?.status === "paused") {
      throw new ConflictError("Já existe uma assinatura ativa. Cancele-a antes de trocar de plano.", "SUBSCRIPTION_ACTIVE");
    }
    if (current?.status === "pending") {
      // Checkout anterior abandonado: só abre outro depois de confirmar que o link antigo não cobra mais.
      // Falha ao falar com o Mercado Pago interrompe aqui (sem novo checkout) para não haver duas assinaturas cobrando.
      if (current.provider_id) {
        const previous = await mercadoPago.getPreapproval(current.provider_id);
        if (previous.status === "authorized" || previous.status === "paused") {
          // O cliente concluiu o checkout antigo: vale ele.
          await applyProviderState(current, previous);
          throw new ConflictError("Já existe uma assinatura ativa. Cancele-a antes de trocar de plano.", "SUBSCRIPTION_ACTIVE");
        }
        if (previous.status !== "cancelled") {
          const closed = await mercadoPago.cancelPreapproval(current.provider_id);
          if (closed.status !== "cancelled") {
            throw new AppError(502, "PREVIOUS_CHECKOUT_OPEN", "Não foi possível encerrar o checkout anterior no Mercado Pago. Tente novamente.");
          }
        }
      }
      await db.query(`UPDATE subscriptions SET status = 'cancelled', cancelled_at = now(), ends_at = now(), updated_at = now() WHERE id = $1`, [current.id]);
    }
    const backUrl = returnUrl(ctx.workspaceId);
    const plan = PLANS[input.plan];
    const { rows } = await db.query<SubRow>(
      `INSERT INTO subscriptions (workspace_id, plan, amount_cents, payer_email, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [ctx.workspaceId, input.plan, plan.priceCents, input.payerEmail, ctx.userId],
    );
    const sub = rows[0];
    try {
      const mp = await mercadoPago.createPreapproval({
        reason: `Andamo ${plan.name} (teste)`,
        amountCents: plan.priceCents,
        payerEmail: input.payerEmail,
        externalReference: sub.id,
        backUrl,
      });
      await db.query(`UPDATE subscriptions SET provider_id = $2, updated_at = now() WHERE id = $1`, [sub.id, mp.id]);
      await audit({ actorId: ctx.userId, workspaceId: ctx.workspaceId, action: "billing.checkout_started", target: sub.id, ip: ctx.ip, data: { plan: input.plan, testMode: true } });
      const url = mp.sandbox_init_point ?? mp.init_point;
      if (!url) throw new BadRequestError("O Mercado Pago não retornou o link de pagamento.");
      return { checkoutUrl: url, subscription: toDTO({ ...sub, provider_id: mp.id }) };
    } catch (e) {
      await db.query(`DELETE FROM subscriptions WHERE id = $1`, [sub.id]);
      throw e;
    }
  },

  /** Consulta o Mercado Pago e atualiza (útil ao voltar do checkout, se o webhook ainda não chegou). */
  async sync(workspaceId: string): Promise<BillingInfo> {
    const sub = await latest(workspaceId);
    if (sub?.provider_id && sub.status !== "cancelled") await applyProviderState(sub, await mercadoPago.getPreapproval(sub.provider_id));
    return this.info(workspaceId);
  },

  async cancel(ctx: { workspaceId: string; userId: string; ip: string | null }): Promise<BillingInfo> {
    const sub = await latest(ctx.workspaceId);
    if (!sub || sub.status === "cancelled") throw new NotFoundError("Assinatura ativa");
    const mp = sub.provider_id ? await mercadoPago.cancelPreapproval(sub.provider_id) : null;
    if (mp) await applyProviderState(sub, mp);
    else await db.query(`UPDATE subscriptions SET status = 'cancelled', cancelled_at = now(), ends_at = now(), updated_at = now() WHERE id = $1`, [sub.id]);
    await audit({ actorId: ctx.userId, workspaceId: ctx.workspaceId, action: "billing.cancelled", target: sub.id, ip: ctx.ip });
    await expireEnded();
    return this.info(ctx.workspaceId);
  },

  /**
   * Webhook do Mercado Pago (assinatura já validada na rota). Idempotente: sempre relê o estado no MP.
   * Notificação já processada/ignorada é "duplicate"; uma que falhou pode ser reprocessada no reenvio.
   */
  async handleWebhook(input: { requestId: string; type: string; resourceId: string }) {
    const { rows: inserted } = await db.query<{ id: string }>(
      `INSERT INTO payment_events (provider, request_id, type, resource_id) VALUES ('mercadopago', $1, $2, $3)
       ON CONFLICT (provider, request_id) DO UPDATE SET status = 'received', detail = NULL
       WHERE payment_events.status = 'failed'
       RETURNING id`,
      [input.requestId, input.type, input.resourceId],
    );
    if (!inserted[0]) return "duplicate";
    const mark = (status: string, detail?: string) =>
      db.query(`UPDATE payment_events SET status = $2, detail = $3 WHERE id = $1`, [inserted[0].id, status, detail ?? null]);
    if (input.type !== "subscription_preapproval") {
      await mark("ignored", "tipo não tratado");
      return "ignored";
    }
    try {
      const mp = await mercadoPago.getPreapproval(input.resourceId);
      const { rows } = await db.query<SubRow>(`SELECT * FROM subscriptions WHERE id::text = $1 OR provider_id = $2 LIMIT 1`, [mp.external_reference ?? "", mp.id]);
      if (!rows[0]) {
        await mark("ignored", "assinatura desconhecida");
        return "ignored";
      }
      await applyProviderState(rows[0], mp);
      await mark("processed", mp.status);
      return "processed";
    } catch (e) {
      await mark("failed", (e as Error).message.slice(0, 300));
      throw e;
    }
  },
};

/** Assinaturas canceladas cujo ciclo pago acabou → workspace volta ao Free (dados preservados). */
async function expireEnded() {
  const { rows } = await db.query<{ id: string; workspace_id: string }>(
    `SELECT s.id, s.workspace_id FROM subscriptions s JOIN workspaces w ON w.id = s.workspace_id
     WHERE s.status = 'cancelled' AND s.ends_at <= now() AND s.expired_at IS NULL AND w.plan <> 'free'
       AND s.id = (SELECT s2.id FROM subscriptions s2 WHERE s2.workspace_id = s.workspace_id ORDER BY s2.created_at DESC LIMIT 1)`,
  );
  for (const r of rows) {
    await setPlan(r.workspace_id, "free", "Fim do ciclo após cancelamento", r.id);
    await db.query(`UPDATE subscriptions SET expired_at = now() WHERE id = $1`, [r.id]);
  }
  return rows.length;
}

registerJob("billing.expire", async () => {
  await expireEnded();
});
registerSchedule("billing.expire", 60);
