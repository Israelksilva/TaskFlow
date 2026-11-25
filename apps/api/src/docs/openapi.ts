import { z } from "zod";
import {
  createTaskSchema,
  importTasksSchema,
  loginSchema,
  registerSchema,
  TASK_PRIORITIES,
  TASK_STATUSES,
  updateTaskSchema,
} from "@andamo/shared";

/**
 * Especificação OpenAPI 3.1 da API v1. Os corpos de requisição são gerados
 * a partir dos mesmos schemas Zod que validam as rotas, então não divergem.
 */
const input = (schema: z.ZodType) =>
  z.toJSONSchema(schema, { io: "input", unrepresentable: "any", target: "draft-2020-12" });

const json = (schema: object) => ({ "application/json": { schema } });
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const errors = (...codes: number[]) =>
  Object.fromEntries(
    codes.map((code) => [code, { description: ERROR_TEXT[code], content: json(ref("Error")) }]),
  );
const ERROR_TEXT: Record<number, string> = {
  400: "Requisição malformada",
  401: "Não autenticado",
  404: "Não encontrado",
  409: "Conflito",
  422: "Dados inválidos",
  429: "Limite de requisições excedido",
};
const idParam = {
  name: "id",
  in: "path",
  required: true,
  schema: { type: "string", format: "uuid" },
};

export function buildOpenApiSpec(version: string) {
  return {
    openapi: "3.1.0",
    info: {
      title: "Andamo API",
      version,
      description:
        "API do Andamo. As rotas também respondem sem o prefixo `/v1` por compatibilidade; prefira `/v1`.",
    },
    servers: [{ url: "/v1" }],
    security: [{ bearerAuth: [] }],
    tags: [{ name: "Autenticação" }, { name: "Tarefas" }],
    paths: {
      "/auth/cadastro": {
        post: {
          tags: ["Autenticação"],
          summary: "Cria conta e devolve token",
          security: [],
          requestBody: { required: true, content: json(input(registerSchema)) },
          responses: {
            201: { description: "Conta criada", content: json(ref("AuthResponse")) },
            ...errors(409, 422, 429),
          },
        },
      },
      "/auth/login": {
        post: {
          tags: ["Autenticação"],
          summary: "Autentica e devolve token",
          security: [],
          requestBody: { required: true, content: json(input(loginSchema)) },
          responses: {
            200: { description: "Autenticado", content: json(ref("AuthResponse")) },
            ...errors(401, 422, 429),
          },
        },
      },
      "/auth/me": {
        get: {
          tags: ["Autenticação"],
          summary: "Usuário autenticado",
          responses: {
            200: {
              description: "Usuário",
              content: json({
                type: "object",
                properties: { user: ref("User") },
                required: ["user"],
              }),
            },
            ...errors(401),
          },
        },
      },
      "/tarefas": {
        get: {
          tags: ["Tarefas"],
          summary: "Lista as tarefas do usuário na ordem do quadro",
          parameters: [
            { name: "search", in: "query", schema: { type: "string", maxLength: 100 } },
            { name: "status", in: "query", schema: { type: "string", enum: TASK_STATUSES } },
            { name: "priority", in: "query", schema: { type: "string", enum: TASK_PRIORITIES } },
          ],
          responses: {
            200: { description: "Tarefas", content: json(ref("TaskList")) },
            ...errors(401, 422),
          },
        },
        post: {
          tags: ["Tarefas"],
          summary: "Cria tarefa no fim da coluna",
          requestBody: { required: true, content: json(input(createTaskSchema)) },
          responses: {
            201: { description: "Criada", content: json(ref("TaskEnvelope")) },
            ...errors(401, 422),
          },
        },
      },
      "/tarefas/importar": {
        post: {
          tags: ["Tarefas"],
          summary: "Importa tarefas em lote (até 500)",
          requestBody: { required: true, content: json(input(importTasksSchema)) },
          responses: {
            201: { description: "Importadas", content: json(ref("TaskList")) },
            ...errors(401, 422),
          },
        },
      },
      "/tarefas/{id}": {
        parameters: [idParam],
        get: {
          tags: ["Tarefas"],
          summary: "Busca uma tarefa",
          responses: {
            200: { description: "Tarefa", content: json(ref("TaskEnvelope")) },
            ...errors(401, 404),
          },
        },
        patch: {
          tags: ["Tarefas"],
          summary: "Atualiza campos, move de coluna ou reordena",
          requestBody: { required: true, content: json(input(updateTaskSchema)) },
          responses: {
            200: { description: "Atualizada", content: json(ref("TaskEnvelope")) },
            ...errors(401, 404, 422),
          },
        },
        delete: {
          tags: ["Tarefas"],
          summary: "Exclui a tarefa",
          responses: { 204: { description: "Excluída" }, ...errors(401, 404) },
        },
      },
    },
    components: {
      securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } },
      schemas: {
        User: {
          type: "object",
          required: ["id", "name", "email", "createdAt"],
          properties: {
            id: { type: "string", format: "uuid" },
            name: { type: "string" },
            email: { type: "string", format: "email" },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        AuthResponse: {
          type: "object",
          required: ["user", "token"],
          properties: { user: ref("User"), token: { type: "string" } },
        },
        Task: {
          type: "object",
          required: [
            "id",
            "title",
            "description",
            "priority",
            "status",
            "position",
            "dueDate",
            "completedAt",
            "createdAt",
            "updatedAt",
          ],
          properties: {
            id: { type: "string", format: "uuid" },
            title: { type: "string" },
            description: { type: ["string", "null"] },
            priority: { type: "string", enum: TASK_PRIORITIES },
            status: { type: "string", enum: TASK_STATUSES },
            position: { type: "integer", minimum: 0 },
            dueDate: { type: ["string", "null"], format: "date" },
            completedAt: { type: ["string", "null"], format: "date-time" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        TaskEnvelope: { type: "object", required: ["task"], properties: { task: ref("Task") } },
        TaskList: {
          type: "object",
          required: ["tasks"],
          properties: { tasks: { type: "array", items: ref("Task") } },
        },
        Error: {
          type: "object",
          required: ["error"],
          properties: {
            error: {
              type: "object",
              required: ["code", "message"],
              properties: {
                code: { type: "string" },
                message: { type: "string" },
                details: {
                  type: "object",
                  additionalProperties: { type: "array", items: { type: "string" } },
                },
              },
            },
          },
        },
      },
    },
  };
}
