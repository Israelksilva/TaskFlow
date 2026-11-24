import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { isTest } from "../../config/env";
import { authenticate } from "../../middlewares/authenticate";
import { authController } from "./auth.controller";

/** Limita tentativas de login/cadastro por IP (proteção contra força bruta). */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skip: () => isTest,
  message: {
    error: { code: "TOO_MANY_REQUESTS", message: "Muitas tentativas. Tente novamente mais tarde." },
  },
});

export const authRoutes = Router();

authRoutes.post("/cadastro", authLimiter, authController.register);
authRoutes.post("/login", authLimiter, authController.login);
authRoutes.get("/me", authenticate, authController.me);
