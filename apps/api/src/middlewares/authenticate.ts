import type { RequestHandler } from "express";
import { db } from "../db";
import { verifyAccessToken } from "../lib/token";
import { ForbiddenError, UnauthorizedError } from "../shared/errors";

/** Extrai o token de `Authorization: Bearer <token>`. */
export function bearerToken(header: string | undefined): string | null {
  const [scheme, token] = header?.split(" ") ?? [];
  return scheme === "Bearer" && token ? token : null;
}

/**
 * Valida o access token E a sessão no banco: encerrar uma sessão (logout em outro
 * dispositivo, troca de senha) invalida o acesso imediatamente, não só quando o token expira.
 */
export async function resolveAuth(token: string) {
  const { sub, sid } = verifyAccessToken(token);
  const { rows } = await db.query<{ is_platform_admin: boolean }>(
    `SELECT u.is_platform_admin FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.id = $1 AND s.user_id = $2 AND s.revoked_at IS NULL AND s.expires_at > now() AND u.deleted_at IS NULL`,
    [sid, sub],
  );
  if (!rows[0]) throw new UnauthorizedError("Sessão encerrada. Faça login novamente.", "SESSION_REVOKED");
  return { userId: sub, sessionId: sid, isPlatformAdmin: rows[0].is_platform_admin };
}

export const authenticate: RequestHandler = async (req, _res, next) => {
  const token = bearerToken(req.headers.authorization);
  if (!token) throw new UnauthorizedError("Token de acesso ausente", "MISSING_TOKEN");
  req.auth = await resolveAuth(token);
  next();
};

/** Painel administrativo da plataforma (não confundir com admin de workspace). */
export const requirePlatformAdmin: RequestHandler = (req, _res, next) => {
  if (!req.auth?.isPlatformAdmin) throw new ForbiddenError("Acesso restrito à administração do Andamo");
  next();
};
