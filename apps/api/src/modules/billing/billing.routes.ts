import { Router } from "express";
import { checkoutSchema } from "@andamo/shared";
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

/** /v1/pagamentos/webhook — público, autenticado pela assinatura HMAC do Mercado Pago. */
export const paymentWebhookRoutes = Router();
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
