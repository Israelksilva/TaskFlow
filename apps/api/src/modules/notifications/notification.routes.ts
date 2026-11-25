import { Router } from "express";
import { z } from "zod";
import { notificationPreferencesSchema, notificationQuerySchema, pushSubscriptionSchema } from "@andamo/shared";
import { env } from "../../config/env";
import { authenticate } from "../../middlewares/authenticate";
import { clientInfo, getUserId, idParam } from "../../shared/http";
import { parse } from "../../shared/validation";
import { notificationService as s } from "./notification.service";

export const notificationRoutes = Router();
notificationRoutes.use(authenticate);

notificationRoutes.get("/", async (req, res) => {
  res.json(await s.list(getUserId(req), parse(notificationQuerySchema, req.query)));
});

notificationRoutes.get("/contagem", async (req, res) => {
  res.json({ unread: await s.unreadCount(getUserId(req)) });
});

notificationRoutes.post("/lidas", async (req, res) => {
  res.json({ updated: await s.markAllRead(getUserId(req)) });
});

notificationRoutes.get("/preferencias", async (req, res) => {
  res.json({ preferences: await s.getPreferences(getUserId(req)) });
});

notificationRoutes.put("/preferencias", async (req, res) => {
  res.json({ preferences: await s.updatePreferences(getUserId(req), parse(notificationPreferencesSchema, req.body)) });
});

notificationRoutes.get("/push/chave", (_req, res) => {
  res.json({ publicKey: env.VAPID_PUBLIC_KEY ?? null });
});

notificationRoutes.post("/push/inscricoes", async (req, res) => {
  await s.subscribePush(getUserId(req), parse(pushSubscriptionSchema, req.body), clientInfo(req).userAgent);
  res.status(201).json({ ok: true });
});

notificationRoutes.delete("/push/inscricoes", async (req, res) => {
  const { endpoint } = parse(z.object({ endpoint: z.string().url().max(2000) }), req.body);
  await s.unsubscribePush(getUserId(req), endpoint);
  res.status(204).end();
});

notificationRoutes.post("/:id/lida", async (req, res) => {
  const { read } = parse(z.object({ read: z.boolean().default(true) }), req.body ?? {});
  await s.markRead(getUserId(req), idParam(req, "id", "Notificação"), read);
  res.status(204).end();
});

notificationRoutes.delete("/:id", async (req, res) => {
  await s.remove(getUserId(req), idParam(req, "id", "Notificação"));
  res.status(204).end();
});
