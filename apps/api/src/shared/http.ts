import type { Request } from "express";
import { z } from "zod";
import { ForbiddenError, NotFoundError, UnauthorizedError } from "./errors";

/** Retorna o id do usuário autenticado (definido pelo middleware `authenticate`). */
export function getUserId(req: Request): string {
  if (!req.auth?.userId) throw new UnauthorizedError();
  return req.auth.userId;
}

export function getAuth(req: Request) {
  if (!req.auth) throw new UnauthorizedError();
  return req.auth;
}

/** Workspace e papel resolvidos por `requireWorkspace`. */
export function getMembership(req: Request) {
  if (!req.membership) throw new ForbiddenError();
  return req.membership;
}

/** Lê um parâmetro de rota obrigatório como string. */
export function param(req: Request, name: string): string {
  const value = req.params[name];
  return Array.isArray(value) ? value[0] : value;
}

const uuid = z.string().uuid();

/** Parâmetro que deve ser UUID: formatos inválidos não existem → 404 sem consultar o banco. */
export function idParam(req: Request, name: string, resource = "Recurso"): string {
  const value = param(req, name);
  if (!uuid.safeParse(value).success) throw new NotFoundError(resource);
  return value;
}

/** Metadados do dispositivo para a lista de sessões. */
export function clientInfo(req: Request) {
  return {
    ip: (req.ip ?? "").slice(0, 64) || null,
    userAgent: (req.get("user-agent") ?? "").slice(0, 400) || null,
  };
}
