import type { Request, Response } from "express";
import { loginSchema, registerSchema } from "@andamo/shared";
import { getUserId } from "../../shared/http";
import { parse } from "../../shared/validation";
import { authService } from "./auth.service";

export const authController = {
  async register(req: Request, res: Response) {
    const input = parse(registerSchema, req.body);
    res.status(201).json(await authService.register(input));
  },

  async login(req: Request, res: Response) {
    const input = parse(loginSchema, req.body);
    res.json(await authService.login(input));
  },

  async me(req: Request, res: Response) {
    res.json({ user: await authService.me(getUserId(req)) });
  },
};
