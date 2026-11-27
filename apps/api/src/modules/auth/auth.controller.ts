import type { Request, Response } from "express";
import {
  changePasswordSchema,
  confirmIdentitySchema,
  enableTwoFactorSchema,
  forgotPasswordSchema,
  googleExchangeSchema,
  googleStartSchema,
  loginSchema,
  mfaLoginSchema,
  refreshSchema,
  registerSchema,
  resetPasswordSchema,
  tokenSchema,
  updateProfileSchema,
} from "@andamo/shared";
import { clientMeta, getSessionId, getUserId, param } from "../../shared/http";
import { ValidationError } from "../../shared/errors";
import { parse } from "../../shared/validation";
import { accountService } from "../account/account.service";
import { googleService } from "../google/google.service";
import { authService } from "./auth.service";
import { twoFactorService } from "./two-factor.service";

export const authController = {
  config(_req: Request, res: Response) {
    res.json(authService.config());
  },

  async register(req: Request, res: Response) {
    res.status(201).json(await authService.register(parse(registerSchema, req.body), clientMeta(req)));
  },

  async login(req: Request, res: Response) {
    res.json(await authService.login(parse(loginSchema, req.body), clientMeta(req)));
  },

  async loginTwoFactor(req: Request, res: Response) {
    const { mfaToken, code } = parse(mfaLoginSchema, req.body);
    res.json(await authService.loginWithTwoFactor(mfaToken, code, clientMeta(req)));
  },

  async refresh(req: Request, res: Response) {
    const { refreshToken } = parse(refreshSchema, req.body);
    res.json(await authService.refresh(refreshToken, clientMeta(req)));
  },

  async logout(req: Request, res: Response) {
    await authService.logout(getUserId(req), getSessionId(req));
    res.status(204).end();
  },

  async me(req: Request, res: Response) {
    res.json({ user: await authService.me(getUserId(req)) });
  },

  async verifyEmail(req: Request, res: Response) {
    const { token } = parse(tokenSchema, req.body);
    res.json({ user: await authService.verifyEmail(token) });
  },

  async resendVerification(req: Request, res: Response) {
    await authService.resendVerification(getUserId(req));
    res.status(202).json({ ok: true });
  },

  async forgotPassword(req: Request, res: Response) {
    await authService.forgotPassword(parse(forgotPasswordSchema, req.body).email);
    res.status(202).json({ ok: true });
  },

  async resetPassword(req: Request, res: Response) {
    await authService.resetPassword(parse(resetPasswordSchema, req.body));
    res.status(204).end();
  },

  // Google
  async googleStart(req: Request, res: Response) {
    res.json(await googleService.startLogin(parse(googleStartSchema, req.body ?? {}).remember));
  },

  async googleCallback(req: Request, res: Response) {
    res.redirect(303, await googleService.callback(req.query as Record<string, unknown>));
  },

  async googleExchange(req: Request, res: Response) {
    res.json(await googleService.exchange(parse(googleExchangeSchema, req.body).code, clientMeta(req)));
  },
};

export const accountController = {
  async updateProfile(req: Request, res: Response) {
    res.json({ user: await accountService.updateProfile(getUserId(req), parse(updateProfileSchema, req.body)) });
  },

  async changePassword(req: Request, res: Response) {
    const input = parse(changePasswordSchema, req.body);
    res.json({ user: await accountService.changePassword(getUserId(req), getSessionId(req), input) });
  },

  async listSessions(req: Request, res: Response) {
    res.json({ sessions: await accountService.listSessions(getUserId(req), getSessionId(req)) });
  },

  async revokeSession(req: Request, res: Response) {
    await accountService.revokeSession(getUserId(req), param(req, "id"));
    res.status(204).end();
  },

  async revokeOtherSessions(req: Request, res: Response) {
    res.json({ revoked: await accountService.revokeOtherSessions(getUserId(req), getSessionId(req)) });
  },

  async twoFactorStatus(req: Request, res: Response) {
    res.json({ recoveryCodesRemaining: await twoFactorService.remainingRecoveryCodes(getUserId(req)) });
  },

  async twoFactorSetup(req: Request, res: Response) {
    res.json(await twoFactorService.setup(getUserId(req)));
  },

  async twoFactorEnable(req: Request, res: Response) {
    res.json(await twoFactorService.enable(getUserId(req), parse(enableTwoFactorSchema, req.body).code));
  },

  async twoFactorDisable(req: Request, res: Response) {
    const { code } = parse(confirmIdentitySchema, req.body);
    if (!code) throw new ValidationError({ code: ["Informe o código"] }, "Informe o código");
    res.json({ user: await twoFactorService.disable(getUserId(req), code) });
  },

  async twoFactorRecoveryCodes(req: Request, res: Response) {
    res.json(await twoFactorService.regenerateRecoveryCodes(getUserId(req), parse(enableTwoFactorSchema, req.body).code));
  },

  async googleLink(req: Request, res: Response) {
    res.json(await googleService.startLink(getUserId(req)));
  },

  async googleUnlink(req: Request, res: Response) {
    res.json({ user: await googleService.unlink(getUserId(req)) });
  },
};
