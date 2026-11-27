import { Router, type Request } from "express";
import { z } from "zod";
import {
  acceptInvitationSchema,
  commentSchema,
  createAutomationSchema,
  createColumnSchema,
  updateAutomationSchema,
  createProjectSchema,
  deleteColumnSchema,
  manualTimeSchema,
  reorderColumnsSchema,
  reportQuerySchema,
  startTimerSchema,
  timeQuerySchema,
  updateColumnSchema,
  updateTimeEntrySchema,
  createWorkspaceSchema,
  cursorQuerySchema,
  dashboardQuerySchema,
  inviteSchema,
  labelSchema,
  reactionSchema,
  searchQuerySchema,
  teamSchema,
  transferOwnershipSchema,
  updateMemberSchema,
  updateProjectSchema,
  updateWorkspaceSchema,
} from "@andamo/shared";
import { authenticate } from "../../middlewares/authenticate";
import { authorize, requireWorkspace, writable } from "../../middlewares/workspace";
import { clientInfo, getMembership, getUserId, idParam } from "../../shared/http";
import { parse } from "../../shared/validation";
import { activityRepository } from "../activity/activity.repository";
import { commentService } from "../comments/comment.service";
import { dashboardService } from "../dashboard/dashboard.service";
import { automationService } from "../automations/automation.service";
import { columnService } from "../projects/column.service";
import { projectService, type ProjectContext } from "../projects/project.service";
import { reportService } from "../reports/report.service";
import { timeService } from "../time/time.service";
import { taskRoutes } from "../tasks/task.routes";
import type { TaskContext } from "../tasks/task.service";
import { workspaceService as ws, type WorkspaceContext } from "./workspace.service";

function wsCtx(req: Request): WorkspaceContext & ProjectContext & TaskContext {
  const m = getMembership(req);
  return { workspaceId: m.workspaceId, userId: getUserId(req), role: m.role, plan: m.plan, isPersonal: m.isPersonal };
}

export const workspaceRoutes = Router();
workspaceRoutes.use(authenticate);

// ---------------------------------------------------------------- sem workspace na rota
workspaceRoutes.get("/", async (req, res) => {
  res.json({ workspaces: await ws.list(getUserId(req)) });
});

workspaceRoutes.post("/", async (req, res) => {
  const { name } = parse(createWorkspaceSchema, req.body);
  res.status(201).json({ workspace: await ws.create(getUserId(req), name) });
});

/** Convites: pré-visualização (público para quem tem o link, mas exige login) e aceite. */
workspaceRoutes.get("/convites/:token", async (req, res) => {
  res.json({ invitation: await ws.previewInvitation(String(req.params.token).slice(0, 200)) });
});

workspaceRoutes.post("/convites/aceitar", async (req, res) => {
  const { token } = parse(acceptInvitationSchema, req.body);
  res.json({ workspace: await ws.acceptInvitation(getUserId(req), token) });
});

// ---------------------------------------------------------------- escopo de workspace (tenant)
const w = Router({ mergeParams: true });
workspaceRoutes.use("/:workspaceId", requireWorkspace, w);

w.get("/", async (req, res) => {
  res.json({ workspace: await ws.get(getUserId(req), getMembership(req).workspaceId) });
});
w.patch("/", authorize("workspace.update"), async (req, res) => {
  res.json({ workspace: await ws.update(wsCtx(req), parse(updateWorkspaceSchema, req.body)) });
});
w.post("/arquivar", authorize("workspace.delete"), async (req, res) => {
  const { archived } = parse(z.object({ archived: z.boolean().default(true) }), req.body ?? {});
  res.json({ workspace: await ws.setArchived(wsCtx(req), archived, clientInfo(req).ip) });
});
w.post("/transferir", authorize("workspace.transfer"), async (req, res) => {
  const { userId } = parse(transferOwnershipSchema, req.body);
  res.json({ workspace: await ws.transferOwnership(wsCtx(req), userId, clientInfo(req).ip) });
});

w.get("/dashboard", async (req, res) => {
  const q = parse(dashboardQuerySchema, req.query);
  res.json(await dashboardService.get(getMembership(req).workspaceId, getUserId(req), q));
});
w.get("/relatorios", async (req, res) => {
  res.json(await reportService.get(wsCtx(req), parse(reportQuerySchema, req.query)));
});
w.get("/busca", async (req, res) => {
  const { q } = parse(searchQuerySchema, req.query);
  res.json(await dashboardService.search(getMembership(req).workspaceId, q));
});
w.get("/atividades", authorize("activity.read"), async (req, res) => {
  const { cursor, limit } = parse(cursorQuerySchema, req.query);
  const projectId = typeof req.query.projectId === "string" && /^[0-9a-f-]{36}$/i.test(req.query.projectId) ? req.query.projectId : undefined;
  res.json(await activityRepository.list(getMembership(req).workspaceId, { cursor, limit, projectId }));
});

// ---- membros
w.get("/membros", async (req, res) => {
  res.json({ members: await ws.members(wsCtx(req)) });
});
w.patch("/membros/:userId", writable, async (req, res) => {
  const data = parse(updateMemberSchema, req.body);
  res.json({ member: await ws.updateMember(wsCtx(req), idParam(req, "userId", "Membro"), data, clientInfo(req).ip) });
});
w.delete("/membros/:userId", async (req, res) => {
  await ws.removeMember(wsCtx(req), idParam(req, "userId", "Membro"), clientInfo(req).ip);
  res.status(204).end();
});

// ---- convites
w.get("/convites", authorize("members.invite"), async (req, res) => {
  res.json({ invitations: await ws.invitations(wsCtx(req)) });
});
w.post("/convites", authorize("members.invite"), async (req, res) => {
  const { email, role } = parse(inviteSchema, req.body);
  res.status(201).json(await ws.invite(wsCtx(req), email, role));
});
w.delete("/convites/:id", authorize("members.invite"), async (req, res) => {
  await ws.revokeInvitation(wsCtx(req), idParam(req, "id", "Convite"));
  res.status(204).end();
});

// ---- equipes
w.get("/equipes", async (req, res) => {
  res.json({ teams: await ws.teams(wsCtx(req)) });
});
w.post("/equipes", authorize("teams.manage"), async (req, res) => {
  res.status(201).json({ team: await ws.saveTeam(wsCtx(req), null, parse(teamSchema, req.body)) });
});
w.put("/equipes/:id", authorize("teams.manage"), async (req, res) => {
  res.json({ team: await ws.saveTeam(wsCtx(req), idParam(req, "id", "Equipe"), parse(teamSchema, req.body)) });
});
w.delete("/equipes/:id", authorize("teams.manage"), async (req, res) => {
  await ws.removeTeam(wsCtx(req), idParam(req, "id", "Equipe"));
  res.status(204).end();
});

// ---- etiquetas
w.get("/etiquetas", async (req, res) => {
  res.json({ labels: await ws.labels(wsCtx(req)) });
});
w.post("/etiquetas", authorize("labels.manage"), async (req, res) => {
  res.status(201).json({ label: await ws.createLabel(wsCtx(req), parse(labelSchema, req.body)) });
});
w.put("/etiquetas/:id", authorize("labels.manage"), async (req, res) => {
  res.json({ label: await ws.updateLabel(wsCtx(req), idParam(req, "id", "Etiqueta"), parse(labelSchema, req.body)) });
});
w.delete("/etiquetas/:id", authorize("labels.manage"), async (req, res) => {
  await ws.removeLabel(wsCtx(req), idParam(req, "id", "Etiqueta"));
  res.status(204).end();
});

// ---- projetos
w.get("/projetos", async (req, res) => {
  const view = parse(z.object({ view: z.enum(["active", "archived", "templates"]).default("active") }), req.query).view;
  res.json({ projects: await projectService.list(wsCtx(req), view) });
});
w.post("/projetos", writable, async (req, res) => {
  res.status(201).json({ project: await projectService.create(wsCtx(req), parse(createProjectSchema, req.body)) });
});
w.get("/projetos/:id", async (req, res) => {
  res.json({ project: await projectService.get(wsCtx(req), idParam(req, "id", "Projeto")) });
});
w.patch("/projetos/:id", writable, async (req, res) => {
  res.json({ project: await projectService.update(wsCtx(req), idParam(req, "id", "Projeto"), parse(updateProjectSchema, req.body)) });
});
w.post("/projetos/:id/duplicar", writable, async (req, res) => {
  res.status(201).json({ project: await projectService.duplicate(wsCtx(req), idParam(req, "id", "Projeto")) });
});
w.post("/projetos/:id/arquivar", writable, async (req, res) => {
  const { archived } = parse(z.object({ archived: z.boolean().default(true) }), req.body ?? {});
  res.json({ project: await projectService.setArchived(wsCtx(req), idParam(req, "id", "Projeto"), archived) });
});
w.delete("/projetos/:id", writable, async (req, res) => {
  await projectService.remove(wsCtx(req), idParam(req, "id", "Projeto"));
  res.status(204).end();
});

// ---- comentários (por tarefa)
const taskIdOf = (req: Request) => idParam(req, "taskId", "Tarefa");
w.get("/tarefas/:taskId/comentarios", async (req, res) => {
  res.json({ comments: await commentService.list(wsCtx(req), taskIdOf(req)) });
});
w.post("/tarefas/:taskId/comentarios", writable, async (req, res) => {
  const { body, parentId } = parse(commentSchema, req.body);
  res.status(201).json({ comment: await commentService.create(wsCtx(req), taskIdOf(req), body, parentId) });
});
w.patch("/tarefas/:taskId/comentarios/:id", writable, async (req, res) => {
  const { body } = parse(commentSchema.pick({ body: true }), req.body);
  res.json({ comment: await commentService.update(wsCtx(req), taskIdOf(req), idParam(req, "id", "Comentário"), body) });
});
w.delete("/tarefas/:taskId/comentarios/:id", writable, async (req, res) => {
  await commentService.remove(wsCtx(req), taskIdOf(req), idParam(req, "id", "Comentário"));
  res.status(204).end();
});
w.post("/tarefas/:taskId/comentarios/:id/reacoes", writable, async (req, res) => {
  const { emoji } = parse(reactionSchema, req.body);
  res.json({ comment: await commentService.toggleReaction(wsCtx(req), taskIdOf(req), idParam(req, "id", "Comentário"), emoji) });
});

// ---- colunas do quadro (Kanban personalizável)
const projectIdOf = (req: Request) => idParam(req, "id", "Projeto");
w.get("/projetos/:id/colunas", async (req, res) => {
  res.json({ columns: await columnService.list(wsCtx(req), projectIdOf(req)) });
});
w.post("/projetos/:id/colunas", writable, async (req, res) => {
  res.status(201).json({ column: await columnService.create(wsCtx(req), projectIdOf(req), parse(createColumnSchema, req.body)) });
});
w.put("/projetos/:id/colunas/ordem", writable, async (req, res) => {
  const { ids } = parse(reorderColumnsSchema, req.body);
  res.json({ columns: await columnService.reorder(wsCtx(req), projectIdOf(req), ids) });
});
w.patch("/projetos/:id/colunas/:columnId", writable, async (req, res) => {
  const data = parse(updateColumnSchema, req.body);
  res.json({ column: await columnService.update(wsCtx(req), projectIdOf(req), idParam(req, "columnId", "Coluna"), data) });
});
w.delete("/projetos/:id/colunas/:columnId", writable, async (req, res) => {
  const { moveToColumnId } = parse(deleteColumnSchema, req.body ?? {});
  await columnService.remove(wsCtx(req), projectIdOf(req), idParam(req, "columnId", "Coluna"), moveToColumnId);
  res.status(204).end();
});

// ---- controle de tempo
w.get("/tempo", async (req, res) => {
  res.json({ entries: await timeService.list(wsCtx(req), parse(timeQuerySchema, req.query)) });
});
w.get("/tempo/resumo", async (req, res) => {
  res.json(await timeService.summary(wsCtx(req), parse(timeQuerySchema, req.query)));
});
w.post("/tarefas/:taskId/tempo/iniciar", writable, async (req, res) => {
  const { switch: switchRunning } = parse(startTimerSchema, req.body ?? {});
  res.status(201).json({ entry: await timeService.start(wsCtx(req), taskIdOf(req), switchRunning) });
});
w.post("/tarefas/:taskId/tempo", writable, async (req, res) => {
  res.status(201).json({ entry: await timeService.addManual(wsCtx(req), taskIdOf(req), parse(manualTimeSchema, req.body)) });
});
w.patch("/tempo/:id", writable, async (req, res) => {
  res.json({ entry: await timeService.update(wsCtx(req), idParam(req, "id", "Registro"), parse(updateTimeEntrySchema, req.body)) });
});
w.delete("/tempo/:id", writable, async (req, res) => {
  await timeService.remove(wsCtx(req), idParam(req, "id", "Registro"));
  res.status(204).end();
});

// ---- automações
w.get("/automacoes", async (req, res) => {
  res.json({ automations: await automationService.list(wsCtx(req)) });
});
w.get("/automacoes/execucoes", async (req, res) => {
  const automationId = typeof req.query.automationId === "string" && /^[0-9a-f-]{36}$/i.test(req.query.automationId) ? req.query.automationId : undefined;
  res.json({ runs: await automationService.runs(wsCtx(req), automationId) });
});
w.post("/automacoes", authorize("automations.manage"), async (req, res) => {
  res.status(201).json({ automation: await automationService.create(wsCtx(req), parse(createAutomationSchema, req.body)) });
});
w.patch("/automacoes/:id", authorize("automations.manage"), async (req, res) => {
  res.json({ automation: await automationService.update(wsCtx(req), idParam(req, "id", "Automação"), parse(updateAutomationSchema, req.body)) });
});
w.delete("/automacoes/:id", authorize("automations.manage"), async (req, res) => {
  await automationService.remove(wsCtx(req), idParam(req, "id", "Automação"));
  res.status(204).end();
});

// ---- tarefas
w.use("/tarefas", taskRoutes);
