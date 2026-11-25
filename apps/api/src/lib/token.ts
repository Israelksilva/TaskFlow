import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../config/env";
import { UnauthorizedError } from "../shared/errors";

export interface AccessTokenPayload {
  /** id do usuário */
  sub: string;
  /** id da sessão (permite revogar dispositivos) */
  sid: string;
}

export function signAccessToken(userId: string, sessionId: string): string {
  return jwt.sign({ sid: sessionId }, env.JWT_SECRET, {
    subject: userId,
    expiresIn: env.ACCESS_TOKEN_TTL as SignOptions["expiresIn"],
    algorithm: "HS256",
    audience: "andamo-api",
  });
}

/** Segundos até o access token expirar (informado ao cliente para renovar antes). */
export function accessTokenTtlSeconds(): number {
  const match = /^(\d+)\s*([smhd])?$/.exec(env.ACCESS_TOKEN_TTL);
  if (!match) return 900;
  const unit = { s: 1, m: 60, h: 3600, d: 86400 }[(match[2] ?? "s") as "s" | "m" | "h" | "d"];
  return Number(match[1]) * unit;
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ["HS256"], audience: "andamo-api" });
    if (typeof payload === "string" || !payload.sub || typeof payload.sid !== "string") {
      throw new Error("payload inválido");
    }
    return { sub: payload.sub, sid: payload.sid };
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError("Sessão expirada. Faça login novamente.", "TOKEN_EXPIRED");
    }
    throw new UnauthorizedError("Token de acesso inválido", "INVALID_TOKEN");
  }
}
