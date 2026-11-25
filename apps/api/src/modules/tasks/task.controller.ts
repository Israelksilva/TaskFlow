import type { Request, Response } from "express";
import { z } from "zod";
import {
  bulkTaskSchema,
  checklistItemSchema,
  createTaskSchema,
  dependencySchema,
  importTasksSchema,
  taskQuerySchema,
  updateChecklistItemSchema,
  updateTaskSchema,
} from "@andamo/shared";
import { BadRequestError, NotFoundError } from "../../shared/errors";
import { getMembership, getUserId, idParam } from "../../shared/http";
import { parse } from "../../shared/validation";
import { activityRepository } from "../activity/activity.repository";
import { workspaceRepository } from "../workspaces/workspace.repository";
import { taskService, type TaskContext } from "./task.service";

const ctxOf = (req: Request): TaskContext => {
  const m = getMembership(req);
  return { workspaceId: m.workspaceId, userId: getUserId(req), role: m.role };
};
const taskId = (req: Request) => idParam(req, "id", "Tarefa");

/** Rotas v1: /v1/workspaces/:workspaceId/tarefas */
export const taskController = {
  async list(req: Request, res: Response) {
    res.json({ tasks: await taskService.list(ctxOf(req), parse(taskQuerySchema, req.query)) });
  },

  async get(req: Request, res: Response) {
    res.json({ task: await taskService.get(ctxOf(req), taskId(req)) });
  },

  async create(req: Request, res: Response) {
    const data = parse(createTaskSchema, req.body);
    if (!data.projectId && !data.parentId) throw new BadRequestError("Informe o projeto da tarefa", "PROJECT_REQUIRED");
    let projectId = data.projectId;
    if (!projectId && data.parentId) projectId = (await taskService.loadOrFail(ctxOf(req), data.parentId)).projectId;
    const task = await taskService.create(ctxOf(req), { ...data, projectId: projectId! });
    res.status(201).location(`${req.baseUrl}/${task.id}`).json({ task });
  },

  async update(req: Request, res: Response) {
    res.json({ task: await taskService.update(ctxOf(req), taskId(req), parse(updateTaskSchema, req.body)) });
  },

  async remove(req: Request, res: Response) {
    await taskService.remove(ctxOf(req), taskId(req));
    res.status(204).end();
  },

  async restore(req: Request, res: Response) {
    res.json({ task: await taskService.restore(ctxOf(req), taskId(req)) });
  },

  async destroy(req: Request, res: Response) {
    await taskService.destroy(ctxOf(req), taskId(req));
    res.status(204).end();
  },

  async archive(req: Request, res: Response) {
    const { archived } = parse(z.object({ archived: z.boolean().default(true) }), req.body ?? {});
    res.json({ task: await taskService.setArchived(ctxOf(req), taskId(req), archived) });
  },

  async duplicate(req: Request, res: Response) {
    res.status(201).json({ task: await taskService.duplicate(ctxOf(req), taskId(req)) });
  },

  async bulk(req: Request, res: Response) {
    res.json(await taskService.bulk(ctxOf(req), parse(bulkTaskSchema, req.body)));
  },

  async activity(req: Request, res: Response) {
    const ctx = ctxOf(req);
    await taskService.loadOrFail(ctx, taskId(req), undefined, true);
    res.json(await activityRepository.list(ctx.workspaceId, { entityType: "task", entityId: taskId(req), limit: 50 }));
  },

  async addChecklistItem(req: Request, res: Response) {
    const { content } = parse(checklistItemSchema, req.body);
    res.status(201).json({ item: await taskService.addChecklistItem(ctxOf(req), taskId(req), content) });
  },

  async updateChecklistItem(req: Request, res: Response) {
    const data = parse(updateChecklistItemSchema, req.body);
    res.json({ item: await taskService.updateChecklistItem(ctxOf(req), taskId(req), idParam(req, "itemId", "Item"), data) });
  },

  async removeChecklistItem(req: Request, res: Response) {
    await taskService.removeChecklistItem(ctxOf(req), taskId(req), idParam(req, "itemId", "Item"));
    res.status(204).end();
  },

  async addDependency(req: Request, res: Response) {
    const { dependsOnId } = parse(dependencySchema, req.body);
    await taskService.addDependency(ctxOf(req), taskId(req), dependsOnId);
    res.status(204).end();
  },

  async removeDependency(req: Request, res: Response) {
    await taskService.removeDependency(ctxOf(req), taskId(req), idParam(req, "dependsOnId", "Dependência"));
    res.status(204).end();
  },

  async follow(req: Request, res: Response) {
    const { follow } = parse(z.object({ follow: z.boolean() }), req.body);
    await taskService.setFollowing(ctxOf(req), taskId(req), follow);
    res.status(204).end();
  },
};

// ------------------------------------------------------------------ legado
/**
 * Rotas originais (/tarefas): operam no projeto "Minhas tarefas" do workspace pessoal,
 * mantendo compatível o cliente já publicado.
 */
async function legacyCtx(req: Request): Promise<TaskContext & { projectId: string }> {
  const userId = getUserId(req);
  const target = await workspaceRepository.defaultProject(userId);
  if (!target) throw new NotFoundError("Projeto padrão");
  return { workspaceId: target.workspaceId, projectId: target.projectId, userId, role: "owner" };
}

async function legacyTaskId(req: Request, ctx: TaskContext) {
  const id = taskId(req);
  const task = await taskService.loadOrFail(ctx, id);
  return task.id;
}

export const legacyTaskController = {
  async list(req: Request, res: Response) {
    const ctx = await legacyCtx(req);
    const query = parse(taskQuerySchema, req.query);
    res.json({ tasks: await taskService.list(ctx, { ...query, projectId: ctx.projectId }) });
  },

  async get(req: Request, res: Response) {
    const ctx = await legacyCtx(req);
    res.json({ task: await taskService.loadOrFail(ctx, await legacyTaskId(req, ctx)) });
  },

  async create(req: Request, res: Response) {
    const ctx = await legacyCtx(req);
    const task = await taskService.create(ctx, { ...parse(createTaskSchema, req.body), projectId: ctx.projectId });
    res.status(201).location(`${req.baseUrl}/${task.id}`).json({ task });
  },

  async importMany(req: Request, res: Response) {
    const ctx = await legacyCtx(req);
    const { tasks } = parse(importTasksSchema, req.body);
    res.status(201).json({ tasks: await taskService.importMany(ctx, ctx.projectId, tasks) });
  },

  async update(req: Request, res: Response) {
    const ctx = await legacyCtx(req);
    const data = parse(updateTaskSchema, req.body);
    res.json({ task: await taskService.update(ctx, await legacyTaskId(req, ctx), data) });
  },

  async remove(req: Request, res: Response) {
    const ctx = await legacyCtx(req);
    await taskService.remove(ctx, await legacyTaskId(req, ctx));
    res.status(204).end();
  },
};
