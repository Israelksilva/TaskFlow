import type { Request, Response } from "express";
import {
  changePasswordSchema,
  deleteAccountSchema,
  disableTwoFactorSchema,
  enableTwoFactorSchema,
  forgotPasswordSchema,
  googleLoginSchema,
  loginSchema,
  logoutSchema,
  mfaLoginSchema,
  refreshSchema,
  registerSchema,
  resetPasswordSchema,
  updateProfileSchema,
  verifyEmailSchema,
} from "@andamo/shared";
import { NotFoundError } from "../../shared/errors";
import { clientInfo, getAuth, getUserId, idParam } from "../../shared/http";
import { parse } from "../../shared/validation";
import { authService } from "./auth.service";
import { sessionService } from "./session.service";

export const authController = {
  async register(req: Request, res: Response) {
    res.status(201).json(await authService.register(parse(registerSchema, req.body), clientInfo(req)));
  },

  async login(req: Request, res: Response) {
    res.json(await authService.login(parse(loginSchema, req.body), clientInfo(req)));
  },

  async loginMfa(req: Request, res: Response) {
    const { mfaToken, code } = parse(mfaLoginSchema, req.body);
    res.json(await authService.loginWithMfa(mfaToken, code, clientInfo(req)));
  },

  async google(req: Request, res: Response) {
    const { credential } = parse(googleLoginSchema, req.body);
    res.json(await authService.loginWithGoogle(credential, clientInfo(req)));
  },

  async refresh(req: Request, res: Response) {
    const { refreshToken } = parse(refreshSchema, req.body);
    res.json(await authService.refresh(refreshToken, clientInfo(req)));
  },

  async logout(req: Request, res: Response) {
    parse(logoutSchema, req.body ?? {});
    const { userId, sessionId } = getAuth(req);
    await authService.logout(userId, sessionId);
    res.status(204).end();
  },

  async me(req: Request, res: Response) {
    res.json({ user: await authService.me(getUserId(req)) });
  },

  async updateProfile(req: Request, res: Response) {
    res.json({ user: await authService.updateProfile(getUserId(req), parse(updateProfileSchema, req.body)) });
  },

  async completeOnboarding(req: Request, res: Response) {
    res.json({ user: await authService.completeOnboarding(getUserId(req)) });
  },

  async changePassword(req: Request, res: Response) {
    const { currentPassword, newPassword } = parse(changePasswordSchema, req.body);
    const { userId, sessionId } = getAuth(req);
    await authService.changePassword(userId, sessionId, currentPassword, newPassword, clientInfo(req));
    res.status(204).end();
  },

  async resendVerification(req: Request, res: Response) {
    await authService.resendVerification(getUserId(req));
    res.status(202).json({ ok: true });
  },

  async verifyEmail(req: Request, res: Response) {
    await authService.verifyEmail(parse(verifyEmailSchema, req.body).token);
    res.json({ ok: true });
  },

  async forgotPassword(req: Request, res: Response) {
    await authService.forgotPassword(parse(forgotPasswordSchema, req.body).email);
    res.status(202).json({ ok: true });
  },

  async resetPassword(req: Request, res: Response) {
    const { token, password } = parse(resetPasswordSchema, req.body);
    await authService.resetPassword(token, password, clientInfo(req));
    res.json({ ok: true });
  },

  // ---- sessões
  async sessions(req: Request, res: Response) {
    const { userId, sessionId } = getAuth(req);
    res.json({ sessions: await sessionService.list(userId, sessionId) });
  },

  async revokeSession(req: Request, res: Response) {
    const id = idParam(req, "id", "Sessão");
    if (!(await sessionService.revoke(getUserId(req), id))) throw new NotFoundError("Sessão");
    res.status(204).end();
  },

  async revokeOtherSessions(req: Request, res: Response) {
    const { userId, sessionId } = getAuth(req);
    res.json({ revoked: await sessionService.revokeAll(userId, sessionId) });
  },

  // ---- 2FA
  async setupTwoFactor(req: Request, res: Response) {
    res.json(await authService.setupTwoFactor(getUserId(req)));
  },

  async enableTwoFactor(req: Request, res: Response) {
    const { code } = parse(enableTwoFactorSchema, req.body);
    res.json({ user: await authService.enableTwoFactor(getUserId(req), code, clientInfo(req)) });
  },

  async disableTwoFactor(req: Request, res: Response) {
    const { code } = parse(disableTwoFactorSchema, req.body);
    res.json({ user: await authService.disableTwoFactor(getUserId(req), code, clientInfo(req)) });
  },

  // ---- LGPD
  async exportData(req: Request, res: Response) {
    res.setHeader("Content-Disposition", 'attachment; filename="andamo-meus-dados.json"');
    res.json(await authService.exportData(getUserId(req)));
  },

  async deleteAccount(req: Request, res: Response) {
    const { password } = parse(deleteAccountSchema, req.body);
    await authService.deleteAccount(getUserId(req), password, clientInfo(req));
    res.status(204).end();
  },
};
