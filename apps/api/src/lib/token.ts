import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../config/env";
import { UnauthorizedError } from "../shared/errors";

interface TokenPayload {
  sub: string;
}

export function signAccessToken(userId: string): string {
  return jwt.sign({}, env.JWT_SECRET, {
    subject: userId,
    expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"],
    algorithm: "HS256",
  });
}

export function verifyAccessToken(token: string): TokenPayload {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ["HS256"] });
    if (typeof payload === "string" || !payload.sub) throw new Error("payload inválido");
    return { sub: payload.sub };
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError("Sessão expirada. Faça login novamente.", "TOKEN_EXPIRED");
    }
    throw new UnauthorizedError("Token de acesso inválido", "INVALID_TOKEN");
  }
}
