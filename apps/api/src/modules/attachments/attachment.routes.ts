import { Router, type Request } from "express";
import { attachmentQuerySchema, createAttachmentSchema } from "@andamo/shared";
import { writable } from "../../middlewares/workspace";
import { getMembership, getUserId, idParam } from "../../shared/http";
import { parse } from "../../shared/validation";
import { attachmentService, type FileContext } from "./attachment.service";

/** /v1/workspaces/:workspaceId/arquivos — documentos do projeto e anexos de tarefas (Cloudflare R2 privado). */
export const attachmentRoutes = Router({ mergeParams: true });

const ctx = (req: Request): FileContext => {
  const m = getMembership(req);
  return { workspaceId: m.workspaceId, userId: getUserId(req), role: m.role, plan: m.plan };
};

attachmentRoutes.get("/", async (req, res) => {
  res.json({ attachments: await attachmentService.list(ctx(req), parse(attachmentQuerySchema, req.query)) });
});
attachmentRoutes.get("/uso", async (req, res) => {
  res.json(await attachmentService.usage(ctx(req)));
});
attachmentRoutes.post("/", writable, async (req, res) => {
  res.status(201).json(await attachmentService.create(ctx(req), parse(createAttachmentSchema, req.body)));
});
attachmentRoutes.post("/:id/concluir", writable, async (req, res) => {
  res.json({ attachment: await attachmentService.complete(ctx(req), idParam(req, "id", "Arquivo")) });
});
attachmentRoutes.get("/:id/download", async (req, res) => {
  res.set("Cache-Control", "no-store").json(await attachmentService.download(ctx(req), idParam(req, "id", "Arquivo")));
});
attachmentRoutes.delete("/:id", writable, async (req, res) => {
  await attachmentService.remove(ctx(req), idParam(req, "id", "Arquivo"));
  res.status(204).end();
});
