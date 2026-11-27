import { z } from "zod";
import {
  changePasswordSchema,
  confirmIdentitySchema,
  contactSchema,
  enableTwoFactorSchema,
  forgotPasswordSchema,
  googleExchangeSchema,
  googleStartSchema,
  mfaLoginSchema,
  refreshSchema,
  resetPasswordSchema,
  tokenSchema,
  updateProfileSchema,
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
  403: "Proibido",
  404: "Não encontrado",
  409: "Conflito",
  422: "Dados inválidos",
  429: "Limite de requisições excedido",
  503: "Recurso não configurado no servidor",
};

const obj = (properties: Record<string, object>, required = Object.keys(properties)) => ({
  type: "object",
  properties,
  required,
});
const okBody = obj({ ok: { type: "boolean" } });
const userEnvelope = obj({ user: ref("User") });

/** Operação JSON compacta. `body` é um schema Zod (entrada); `ok` é [status, descrição, schema?]. */
function op(
  tag: string,
  summary: string,
  { body, ok, errs = [], open = false }: { body?: z.ZodType; ok: [number, string, object?]; errs?: number[]; open?: boolean },
) {
  const [status, description, schema] = ok;
  return {
    tags: [tag],
    summary,
    ...(open ? { security: [] } : {}),
    ...(body ? { requestBody: { required: true, content: json(input(body)) } } : {}),
    responses: { [status]: { description, ...(schema ? { content: json(schema) } : {}) }, ...errors(...errs) },
  };
}

const A = "Autenticação";
const C = "Conta";
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
    tags: [{ name: "Autenticação" }, { name: "Conta" }, { name: "Tarefas" }, { name: "Público" }],
    paths: {
      "/contato": {
        post: {
          tags: ["Público"],
          summary: "Envia mensagem do formulário de contato (5 por hora por IP)",
          security: [],
          requestBody: { required: true, content: json(input(contactSchema)) },
          responses: {
            201: {
              description: "Recebida",
              content: json({ type: "object", properties: { ok: { type: "boolean" } } }),
            },
            ...errors(422, 429),
          },
        },
      },
      "/auth/cadastro": {
        post: {
          tags: ["Autenticação"],
          summary: "Cria conta e abre sessão (envia e-mail de verificação)",
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
          summary: "Autentica; com 2FA ativo devolve um desafio (`mfaRequired`)",
          security: [],
          requestBody: { required: true, content: json(input(loginSchema)) },
          responses: {
            200: {
              description: "Sessão aberta ou desafio de 2FA",
              content: json({ oneOf: [ref("AuthResponse"), ref("MfaChallenge")] }),
            },
            ...errors(401, 422, 429),
          },
        },
      },
      "/auth/config": {
        get: op(A, "O que está habilitado (e-mail, Google)", {
          open: true,
          ok: [200, "Configuração", obj({ emailEnabled: { type: "boolean" }, googleEnabled: { type: "boolean" } })],
        }),
      },
      "/auth/2fa/login": {
        post: op(A, "Conclui o login com o código do app ou de recuperação", {
          open: true,
          body: mfaLoginSchema,
          ok: [200, "Sessão aberta", ref("AuthResponse")],
          errs: [401, 422, 429],
        }),
      },
      "/auth/sessao/renovar": {
        post: op(A, "Troca o refresh token por um novo par (reuso derruba a sessão)", {
          open: true,
          body: refreshSchema,
          ok: [200, "Sessão renovada", ref("AuthResponse")],
          errs: [401, 422, 429],
        }),
      },
      "/auth/sair": { post: op(A, "Encerra a sessão atual", { ok: [204, "Encerrada"], errs: [401] }) },
      "/auth/email/verificar": {
        post: op(A, "Confirma o e-mail com o token do link", {
          open: true,
          body: tokenSchema,
          ok: [200, "Verificado", userEnvelope],
          errs: [422, 429],
        }),
      },
      "/auth/email/reenviar": {
        post: op(A, "Reenvia o e-mail de verificação", { ok: [202, "Aceito", okBody], errs: [401, 429] }),
      },
      "/auth/senha/esqueci": {
        post: op(A, "Pede o link de redefinição (resposta igual exista ou não a conta)", {
          open: true,
          body: forgotPasswordSchema,
          ok: [202, "Aceito", okBody],
          errs: [422, 429],
        }),
      },
      "/auth/senha/redefinir": {
        post: op(A, "Define nova senha com o token e encerra todas as sessões", {
          open: true,
          body: resetPasswordSchema,
          ok: [204, "Senha redefinida"],
          errs: [422, 429],
        }),
      },
      "/auth/google/iniciar": {
        post: op(A, "URL de autorização do Google (OAuth + PKCE)", {
          open: true,
          body: googleStartSchema,
          ok: [200, "URL", obj({ url: { type: "string", format: "uri" } })],
          errs: [429, 503],
        }),
      },
      "/auth/google/callback": {
        get: {
          tags: [A],
          summary: "Retorno do Google; redireciona para o front com um código de uso único",
          security: [],
          responses: { 303: { description: "Redireciona para o front" } },
        },
      },
      "/auth/google/trocar": {
        post: op(A, "Troca o código de uso único (60 s) pela sessão", {
          open: true,
          body: googleExchangeSchema,
          ok: [200, "Sessão ou desafio de 2FA", { oneOf: [ref("AuthResponse"), ref("MfaChallenge")] }],
          errs: [401, 422, 429],
        }),
      },
      "/conta": {
        patch: op(C, "Atualiza nome, idioma e fuso", { body: updateProfileSchema, ok: [200, "Atualizada", userEnvelope], errs: [401, 422] }),
      },
      "/conta/senha": {
        post: op(C, "Troca (ou define) a senha e encerra as outras sessões", {
          body: changePasswordSchema,
          ok: [200, "Senha alterada", userEnvelope],
          errs: [401, 422, 429],
        }),
      },
      "/conta/sessoes": {
        get: op(C, "Sessões ativas", {
          ok: [200, "Sessões", obj({ sessions: { type: "array", items: ref("Session") } })],
          errs: [401],
        }),
      },
      "/conta/sessoes/encerrar-outras": {
        post: op(C, "Encerra todas as sessões, menos a atual", {
          ok: [200, "Quantidade encerrada", obj({ revoked: { type: "integer" } })],
          errs: [401],
        }),
      },
      "/conta/sessoes/{id}": {
        parameters: [idParam],
        delete: op(C, "Encerra uma sessão", { ok: [204, "Encerrada"], errs: [401, 404] }),
      },
      "/conta/2fa": {
        get: op(C, "Códigos de recuperação restantes", {
          ok: [200, "Status", obj({ recoveryCodesRemaining: { type: "integer" } })],
          errs: [401],
        }),
      },
      "/conta/2fa/configurar": {
        post: op(C, "Gera o segredo do app autenticador (ainda inativo)", {
          ok: [200, "Segredo", obj({ secret: { type: "string" }, otpauthUrl: { type: "string" } })],
          errs: [401, 409],
        }),
      },
      "/conta/2fa/ativar": {
        post: op(C, "Ativa o 2FA com um código e devolve os códigos de recuperação", {
          body: enableTwoFactorSchema,
          ok: [200, "Ativado", obj({ user: ref("User"), recoveryCodes: { type: "array", items: { type: "string" } } })],
          errs: [401, 409, 422, 429],
        }),
      },
      "/conta/2fa/desativar": {
        post: op(C, "Desativa o 2FA (exige código do app ou de recuperação)", {
          body: confirmIdentitySchema,
          ok: [200, "Desativado", userEnvelope],
          errs: [401, 409, 422, 429],
        }),
      },
      "/conta/2fa/codigos": {
        post: op(C, "Gera novos códigos de recuperação (invalida os anteriores)", {
          body: enableTwoFactorSchema,
          ok: [200, "Códigos", obj({ recoveryCodes: { type: "array", items: { type: "string" } } })],
          errs: [401, 409, 422, 429],
        }),
      },
      "/conta/google/vincular": {
        post: op(C, "URL para conectar a conta Google", {
          ok: [200, "URL", obj({ url: { type: "string", format: "uri" } })],
          errs: [401, 503],
        }),
      },
      "/conta/google": {
        delete: op(C, "Desconecta o Google (exige senha definida)", { ok: [200, "Desconectado", userEnvelope], errs: [401, 409] }),
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
        User: obj({
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          email: { type: "string", format: "email" },
          createdAt: { type: "string", format: "date-time" },
          emailVerified: { type: "boolean" },
          hasPassword: { type: "boolean" },
          twoFactorEnabled: { type: "boolean" },
          googleLinked: { type: "boolean" },
          locale: { type: "string" },
          timezone: { type: "string" },
        }),
        AuthResponse: obj({
          user: ref("User"),
          accessToken: { type: "string", description: "JWT de 15 min" },
          refreshToken: { type: "string", description: "Opaco; trocado a cada renovação" },
          expiresIn: { type: "integer", description: "Segundos" },
        }),
        MfaChallenge: obj({ mfaRequired: { type: "boolean", const: true }, mfaToken: { type: "string" } }),
        Session: obj({
          id: { type: "string", format: "uuid" },
          current: { type: "boolean" },
          userAgent: { type: ["string", "null"] },
          ip: { type: ["string", "null"] },
          createdAt: { type: "string", format: "date-time" },
          lastUsedAt: { type: "string", format: "date-time" },
          expiresAt: { type: "string", format: "date-time" },
        }),
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
