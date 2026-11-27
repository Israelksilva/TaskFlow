import type { Request } from "express";
import { UnauthorizedError } from "./errors";

/** Retorna o id do usuário autenticado (definido pelo middleware `authenticate`). */
export function getUserId(req: Request): string {
  if (!req.auth?.userId) throw new UnauthorizedError();
  return req.auth.userId;
}

/** Lê um parâmetro de rota obrigatório como string. */
export function param(req: Request, name: string): string {
  const value = req.params[name];
  return Array.isArray(value) ? value[0] : value;
}

/** Id da sessão atual (definido pelo middleware `authenticate`). */
export function getSessionId(req: Request): string {
  if (!req.auth?.sessionId) throw new UnauthorizedError();
  return req.auth.sessionId;
}

/** Dados do dispositivo guardados na sessão (exibidos em "Sessões ativas"). */
export function clientMeta(req: Request) {
  const ua = req.get("user-agent");
  return { userAgent: ua ? ua.slice(0, 300) : null, ip: req.ip ? req.ip.slice(0, 64) : null };
}
