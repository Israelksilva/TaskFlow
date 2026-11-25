import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { isTest } from "../../config/env";
import { authenticate } from "../../middlewares/authenticate";
import { authController as c } from "./auth.controller";

const limitMessage = {
  error: { code: "TOO_MANY_REQUESTS", message: "Muitas tentativas. Tente novamente mais tarde." },
};

/** Limite por IP nas rotas sensíveis (força bruta e abuso de envio de e-mail). */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skip: () => isTest,
  message: limitMessage,
});

/** Renovação de sessão é frequente, mas ainda limitada. */
const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skip: () => isTest,
  message: limitMessage,
});

export const authRoutes = Router();

// Públicas
authRoutes.post("/cadastro", authLimiter, c.register);
authRoutes.post("/login", authLimiter, c.login);
authRoutes.post("/login/2fa", authLimiter, c.loginMfa);
authRoutes.post("/google", authLimiter, c.google);
authRoutes.post("/refresh", refreshLimiter, c.refresh);
authRoutes.post("/esqueci-senha", authLimiter, c.forgotPassword);
authRoutes.post("/redefinir-senha", authLimiter, c.resetPassword);
authRoutes.post("/verificar-email", authLimiter, c.verifyEmail);

// Autenticadas
authRoutes.use(authenticate);
authRoutes.get("/me", c.me);
authRoutes.post("/logout", c.logout);
authRoutes.patch("/perfil", c.updateProfile);
authRoutes.post("/onboarding", c.completeOnboarding);
authRoutes.post("/senha", authLimiter, c.changePassword);
authRoutes.post("/verificar-email/reenviar", authLimiter, c.resendVerification);
authRoutes.get("/sessoes", c.sessions);
authRoutes.post("/sessoes/encerrar-outras", c.revokeOtherSessions);
authRoutes.delete("/sessoes/:id", c.revokeSession);
authRoutes.post("/2fa/configurar", c.setupTwoFactor);
authRoutes.post("/2fa/ativar", authLimiter, c.enableTwoFactor);
authRoutes.post("/2fa/desativar", authLimiter, c.disableTwoFactor);
authRoutes.get("/exportar", c.exportData);
authRoutes.post("/excluir-conta", authLimiter, c.deleteAccount);
