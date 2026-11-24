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
