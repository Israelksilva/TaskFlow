import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { UnauthorizedError } from "../shared/errors";

interface TokenPayload {
  sub: string;
  sid: string;
}

export const ACCESS_TOKEN_TTL_SECONDS = env.ACCESS_TOKEN_TTL_MIN * 60;

/** Token de acesso curto, amarrado à sessão (`sid`) para que encerrar a sessão o invalide. */
export function signAccessToken(userId: string, sessionId: string): string {
  return jwt.sign({ sid: sessionId }, env.JWT_SECRET, {
    subject: userId,
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    algorithm: "HS256",
  });
}

export function verifyAccessToken(token: string): TokenPayload {
  let payload: string | jwt.JwtPayload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ["HS256"] });
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError("Sessão expirada. Faça login novamente.", "TOKEN_EXPIRED");
    }
    throw new UnauthorizedError("Token de acesso inválido", "INVALID_TOKEN");
  }
  // Tokens anteriores à Fase 4 não têm sessão: exigem novo login.
  if (typeof payload === "string" || !payload.sub || typeof payload.sid !== "string") {
    throw new UnauthorizedError("Sessão expirada. Faça login novamente.", "INVALID_TOKEN");
  }
  return { sub: payload.sub, sid: payload.sid };
}
