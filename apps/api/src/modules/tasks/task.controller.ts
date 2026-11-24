import type { Request, Response } from "express";
import { z } from "zod";
import {
  createTaskSchema,
  importTasksSchema,
  taskQuerySchema,
  updateTaskSchema,
} from "@andamo/shared";
import { NotFoundError } from "../../shared/errors";
import { getUserId, param } from "../../shared/http";
import { parse } from "../../shared/validation";
import { taskService } from "./task.service";

const uuid = z.string().uuid();

/** IDs fora do formato UUID não podem existir: respondemos 404 sem consultar o banco. */
function taskId(req: Request): string {
  const id = param(req, "id");
  if (!uuid.safeParse(id).success) throw new NotFoundError("Tarefa");
  return id;
}

export const taskController = {
  /** GET /tarefas?search=&status=&priority= */
  async list(req: Request, res: Response) {
    const query = parse(taskQuerySchema, req.query);
    res.json({ tasks: await taskService.list(getUserId(req), query) });
  },

  /** GET /tarefas/:id */
  async get(req: Request, res: Response) {
    res.json({ task: await taskService.get(getUserId(req), taskId(req)) });
  },

  /** POST /tarefas → 201 com a tarefa salva (incluindo o id). */
  async create(req: Request, res: Response) {
    const data = parse(createTaskSchema, req.body);
    const task = await taskService.create(getUserId(req), data);
    res.status(201).location(`${req.baseUrl}/${task.id}`).json({ task });
  },

  /** POST /tarefas/importar → 201 com as tarefas criadas. */
  async importMany(req: Request, res: Response) {
    const { tasks } = parse(importTasksSchema, req.body);
    res.status(201).json({ tasks: await taskService.importMany(getUserId(req), tasks) });
  },

  /** PATCH /tarefas/:id → atualiza somente os campos enviados. */
  async update(req: Request, res: Response) {
    const data = parse(updateTaskSchema, req.body);
    res.json({ task: await taskService.update(getUserId(req), taskId(req), data) });
  },

  /** DELETE /tarefas/:id → 204. */
  async remove(req: Request, res: Response) {
    await taskService.remove(getUserId(req), taskId(req));
    res.status(204).end();
  },
};
