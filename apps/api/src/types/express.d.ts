import type { PlanId, Role } from "@andamo/shared";

declare global {
  namespace Express {
    interface Request {
      auth?: { userId: string; sessionId: string; isPlatformAdmin: boolean; mfaEnabled: boolean };
      /** Preenchido por `requireWorkspace`: o workspace da rota e o papel do usuário nele. */
      membership?: { workspaceId: string; role: Role; plan: PlanId; isPersonal: boolean; archived: boolean };
    }
  }
}

export {};
