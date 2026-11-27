import { Router } from "express";
import { checkoutSchema } from "@andamo/shared";
import { env } from "../../config/env";
import { verifyWebhookSignature } from "../../lib/mercadopago";
import { logger } from "../../lib/logger";
import { authorize } from "../../middlewares/workspace";
import { clientInfo, getMembership, getUserId } from "../../shared/http";
import { parse } from "../../shared/validation";
import { billingService } from "./billing.service";

/** /v1/workspaces/:workspaceId/assinatura — somente o proprietário (permissão workspace.billing). */
export const billingRoutes = Router({ mergeParams: true });
billingRoutes.use(authorize("workspace.billing"));

const ctx = (req: Parameters<typeof getUserId>[0]) => ({ workspaceId: getMembership(req).workspaceId, userId: getUserId(req), ip: clientInfo(req).ip });

billingRoutes.get("/", async (req, res) => {
  res.json(await billingService.info(getMembership(req).workspaceId));
});
billingRoutes.post("/checkout", async (req, res) => {
  res.status(201).json(await billingService.checkout(ctx(req), parse(checkoutSchema, req.body)));
});
billingRoutes.post("/sincronizar", async (req, res) => {
  res.json(await billingService.sync(getMembership(req).workspaceId));
});
billingRoutes.post("/cancelar", async (req, res) => {
  res.json(await billingService.cancel(ctx(req)));
});

/** Rotas públicas de pagamento (sem login). */
export const paymentWebhookRoutes = Router();

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * GET /v1/pagamentos/retorno/:workspaceId — página para onde o Mercado Pago devolve o comprador.
 * Não lê nem altera nada no banco e ignora os parâmetros que o Mercado Pago anexa: o plano só muda com a
 * confirmação do provedor (webhook ou consulta feita pela tela de planos).
 */
paymentWebhookRoutes.get("/retorno/:workspaceId", (req, res) => {
  const ws = String(req.params.workspaceId);
  if (!UUID.test(ws)) {
    res.status(404).type("text/plain").send("Página não encontrada");
    return;
  }
  const target = escapeHtml(`${env.APP_URL.replace(/\/$/, "")}/#/app/w/${ws}/planos`);
  res
    .set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'")
    .set("Cache-Control", "no-store")
    .set("Referrer-Policy", "no-referrer")
    .type("html")
    .send(`<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="4;url=${target}">
<title>Voltando ao Andamo</title>
<style>body{font-family:system-ui,sans-serif;background:#f6f5fb;color:#1b1a2e;display:grid;place-items:center;min-height:100vh;margin:0;padding:16px}
main{max-width:440px;background:#fff;border-radius:16px;padding:28px;box-shadow:0 8px 30px rgba(0,0,0,.08);text-align:center}
a{display:inline-block;margin-top:16px;background:#6d4aff;color:#fff;text-decoration:none;padding:10px 18px;border-radius:10px;font-weight:600}
small{display:block;margin-top:14px;color:#6b6a80}</style></head>
<body><main><h1>Voltando ao Andamo</h1>
<p>Recebemos o retorno do Mercado Pago (ambiente de teste). O plano é atualizado assim que o Mercado Pago confirmar a assinatura.</p>
<a href="${target}">Abrir Planos e assinatura</a>
<small>Você será redirecionado em alguns segundos. Nenhuma cobrança real é feita no modo de teste.</small></main></body></html>`);
});

/** /v1/pagamentos/webhook — público, autenticado pela assinatura HMAC do Mercado Pago. */
paymentWebhookRoutes.post("/webhook", async (req, res) => {
  const body = (req.body ?? {}) as { type?: string; data?: { id?: string } };
  const dataId = String(req.query["data.id"] ?? body.data?.id ?? "");
  const type = String(req.query.type ?? body.type ?? "");
  const requestId = req.get("x-request-id") ?? "";
  if (!verifyWebhookSignature({ signature: req.get("x-signature") ?? undefined, requestId, dataId })) {
    logger.warn({ type }, "Webhook do Mercado Pago com assinatura inválida — recusado");
    res.status(401).json({ error: { code: "INVALID_SIGNATURE", message: "Assinatura inválida" } });
    return;
  }
  const result = await billingService.handleWebhook({ requestId, type, resourceId: dataId });
  res.status(200).json({ result });
});
