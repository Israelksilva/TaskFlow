import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { env, isTest } from "../../config/env";
import { authenticate } from "../../middlewares/authenticate";
import { accountController, authController } from "./auth.controller";

const limiter = (limit: number, windowMin = 15) =>
  rateLimit({
    windowMs: windowMin * 60 * 1000,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skip: () => isTest,
    message: {
      error: { code: "TOO_MANY_REQUESTS", message: "Muitas tentativas. Tente novamente mais tarde." },
    },
  });

/** Por IP: login, cadastro, 2FA e redefinição (o bloqueio por conta fica em `login-throttle`). */
const authLimiter = limiter(env.AUTH_LIMIT_PER_15MIN);
/** Envio de e-mails: menos generoso para não virar canal de spam. */
const mailLimiter = limiter(Math.max(3, Math.floor(env.AUTH_LIMIT_PER_15MIN / 4)));
/** Renovação de sessão acontece a cada 15 min por aba; limite folgado. */
const refreshLimiter = limiter(env.AUTH_LIMIT_PER_15MIN * 10);

export const authRoutes = Router();

authRoutes.get("/config", authController.config);
authRoutes.post("/cadastro", authLimiter, authController.register);
authRoutes.post("/login", authLimiter, authController.login);
authRoutes.post("/2fa/login", authLimiter, authController.loginTwoFactor);
authRoutes.post("/sessao/renovar", refreshLimiter, authController.refresh);
authRoutes.post("/sair", authenticate, authController.logout);
authRoutes.get("/me", authenticate, authController.me);

authRoutes.post("/email/verificar", authLimiter, authController.verifyEmail);
authRoutes.post("/email/reenviar", mailLimiter, authenticate, authController.resendVerification);
authRoutes.post("/senha/esqueci", mailLimiter, authController.forgotPassword);
authRoutes.post("/senha/redefinir", authLimiter, authController.resetPassword);

authRoutes.post("/google/iniciar", authLimiter, authController.googleStart);
authRoutes.get("/google/callback", authLimiter, authController.googleCallback);
authRoutes.post("/google/trocar", authLimiter, authController.googleExchange);

/** Conta do usuário logado (`/v1/conta`). */
export const accountRoutes = Router();
accountRoutes.use(authenticate);

accountRoutes.patch("/", accountController.updateProfile);
accountRoutes.post("/senha", authLimiter, accountController.changePassword);
accountRoutes.get("/sessoes", accountController.listSessions);
accountRoutes.post("/sessoes/encerrar-outras", accountController.revokeOtherSessions);
accountRoutes.delete("/sessoes/:id", accountController.revokeSession);
accountRoutes.get("/2fa", accountController.twoFactorStatus);
accountRoutes.post("/2fa/configurar", accountController.twoFactorSetup);
accountRoutes.post("/2fa/ativar", authLimiter, accountController.twoFactorEnable);
accountRoutes.post("/2fa/desativar", authLimiter, accountController.twoFactorDisable);
accountRoutes.post("/2fa/codigos", authLimiter, accountController.twoFactorRecoveryCodes);
accountRoutes.post("/google/vincular", accountController.googleLink);
accountRoutes.delete("/google", accountController.googleUnlink);
