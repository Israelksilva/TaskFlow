import { Router } from "express";
import { z } from "zod";
import {
  adminSetPlanSchema,
  adminSuspendSchema,
  adminUserQuerySchema,
  adminWorkspaceQuerySchema,
  announcementSchema,
  ticketQuerySchema,
  ticketReplySchema,
  updateTicketSchema,
} from "@andamo/shared";
import { authenticate, requirePlatformAdmin } from "../../middlewares/authenticate";
import { clientInfo, getUserId, idParam } from "../../shared/http";
import { parse } from "../../shared/validation";
import { supportService } from "../support/support.service";
import { adminService } from "./admin.service";

/** /v1/admin — somente administradores da plataforma com 2FA ativo. */
export const adminRoutes = Router();
adminRoutes.use(authenticate, requirePlatformAdmin);

adminRoutes.get("/visao-geral", async (_req, res) => {
  res.json(await adminService.overview());
});
adminRoutes.get("/status", async (_req, res) => {
  res.json(await adminService.status());
});

adminRoutes.get("/usuarios", async (req, res) => {
  res.json(await adminService.users(parse(adminUserQuerySchema, req.query)));
});
adminRoutes.post("/usuarios/:id/suspensao", async (req, res) => {
  const { suspended, reason } = parse(adminSuspendSchema, req.body);
  await adminService.setSuspended(getUserId(req), idParam(req, "id", "Usuário"), suspended, reason, clientInfo(req).ip);
  res.status(204).end();
});

adminRoutes.get("/workspaces", async (req, res) => {
  res.json({ workspaces: await adminService.workspaces(parse(adminWorkspaceQuerySchema, req.query)) });
});
adminRoutes.post("/workspaces/:id/plano", async (req, res) => {
  const { plan, reason } = parse(adminSetPlanSchema, req.body);
  await adminService.setPlan(getUserId(req), idParam(req, "id", "Workspace"), plan, reason, clientInfo(req).ip);
  res.status(204).end();
});

adminRoutes.get("/auditoria", async (req, res) => {
  const q = parse(z.object({ action: z.string().max(60).optional(), cursor: z.string().max(30).optional() }), req.query);
  res.json(await adminService.auditLog(q));
});

adminRoutes.get("/avisos", async (_req, res) => {
  res.json({ announcements: await adminService.announcements(false) });
});
adminRoutes.post("/avisos", async (req, res) => {
  res.status(201).json({ announcement: await adminService.createAnnouncement(getUserId(req), parse(announcementSchema, req.body), clientInfo(req).ip) });
});
adminRoutes.post("/avisos/:id/encerrar", async (req, res) => {
  await adminService.endAnnouncement(getUserId(req), idParam(req, "id", "Aviso"), clientInfo(req).ip);
  res.status(204).end();
});

adminRoutes.get("/contatos", async (_req, res) => {
  res.json({ messages: await adminService.contacts() });
});
adminRoutes.post("/contatos/:id/atendido", async (req, res) => {
  const { handled } = parse(z.object({ handled: z.boolean().default(true) }), req.body ?? {});
  await adminService.setContactHandled(getUserId(req), idParam(req, "id", "Mensagem"), handled, clientInfo(req).ip);
  res.status(204).end();
});

adminRoutes.get("/suporte", async (req, res) => {
  res.json({ tickets: await supportService.listAll(parse(ticketQuerySchema, req.query)) });
});
adminRoutes.get("/suporte/:id", async (req, res) => {
  res.json(await supportService.getAny(idParam(req, "id", "Chamado")));
});
adminRoutes.post("/suporte/:id/respostas", async (req, res) => {
  const { message } = parse(ticketReplySchema, req.body);
  res.json(await supportService.replyAsStaff(getUserId(req), idParam(req, "id", "Chamado"), message, clientInfo(req).ip));
});
adminRoutes.patch("/suporte/:id", async (req, res) => {
  res.json(await supportService.updateAsStaff(getUserId(req), idParam(req, "id", "Chamado"), parse(updateTicketSchema, req.body), clientInfo(req).ip));
});
