import type { RequestHandler } from "express";
import { verifyAccessToken } from "../lib/token";
import { UnauthorizedError } from "../shared/errors";

/** Exige header `Authorization: Bearer <token>` válido e popula `req.auth`. */
export const authenticate: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  const [scheme, token] = header?.split(" ") ?? [];

  if (scheme !== "Bearer" || !token) {
    throw new UnauthorizedError("Token de acesso ausente", "MISSING_TOKEN");
  }

  const { sub } = verifyAccessToken(token);
  req.auth = { userId: sub };
  next();
};
