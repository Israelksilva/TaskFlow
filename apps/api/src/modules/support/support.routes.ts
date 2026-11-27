import { Router } from "express";
import { createTicketSchema, ticketReplySchema } from "@andamo/shared";
import { authenticate } from "../../middlewares/authenticate";
import { getUserId, idParam } from "../../shared/http";
import { parse } from "../../shared/validation";
import { adminService } from "../admin/admin.service";
import { supportService } from "./support.service";

/** /v1/suporte — chamados do próprio usuário. */
export const supportRoutes = Router();
supportRoutes.use(authenticate);

supportRoutes.get("/chamados", async (req, res) => {
  res.json({ tickets: await supportService.listMine(getUserId(req)) });
});
supportRoutes.post("/chamados", async (req, res) => {
  res.status(201).json({ ticket: await supportService.create(getUserId(req), parse(createTicketSchema, req.body)) });
});
supportRoutes.get("/chamados/:id", async (req, res) => {
  res.json(await supportService.getMine(getUserId(req), idParam(req, "id", "Chamado")));
});
supportRoutes.post("/chamados/:id/respostas", async (req, res) => {
  const { message } = parse(ticketReplySchema, req.body);
  res.json(await supportService.replyAsUser(getUserId(req), idParam(req, "id", "Chamado"), message));
});
supportRoutes.post("/chamados/:id/encerrar", async (req, res) => {
  res.json(await supportService.closeMine(getUserId(req), idParam(req, "id", "Chamado")));
});

/** Avisos globais ativos (faixa no topo do app). */
supportRoutes.get("/avisos", async (_req, res) => {
  res.json({ announcements: await adminService.announcements(true) });
});
