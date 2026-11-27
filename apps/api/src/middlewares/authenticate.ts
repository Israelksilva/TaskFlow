import type { RequestHandler } from "express";
import { verifyAccessToken } from "../lib/token";
import { sessionRepository } from "../modules/sessions/session.repository";
import { UnauthorizedError } from "../shared/errors";

/**
 * Exige `Authorization: Bearer <token>` válido **e** sessão ativa (encerrar uma sessão, trocar a
 * senha ou detectar reuso de refresh token derruba o acesso na hora, sem esperar o token expirar).
 */
export const authenticate: RequestHandler = async (req, _res, next) => {
  const header = req.headers.authorization;
  const [scheme, token] = header?.split(" ") ?? [];

  if (scheme !== "Bearer" || !token) {
    throw new UnauthorizedError("Token de acesso ausente", "MISSING_TOKEN");
  }

  const { sub, sid } = verifyAccessToken(token);
  if (!(await sessionRepository.isActive(sid, sub))) {
    throw new UnauthorizedError("Sessão encerrada. Faça login novamente.", "SESSION_REVOKED");
  }
  req.auth = { userId: sub, sessionId: sid };
  next();
};
