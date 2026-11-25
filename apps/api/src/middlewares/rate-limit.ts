import { rateLimit } from "express-rate-limit";
import { env, isTest } from "../config/env";

/**
 * Limite global por IP para toda a API (exceto health checks).
 * O store é em memória: suficiente para uma instância única no Render.
 * Com várias instâncias, trocar por store compartilhado (Fase 4, S-06).
 */
export const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: env.RATE_LIMIT_PER_MINUTE,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skip: (req) => isTest || req.path.startsWith("/health"),
  message: {
    error: {
      code: "TOO_MANY_REQUESTS",
      message: "Muitas requisições. Tente novamente em instantes.",
    },
  },
});
