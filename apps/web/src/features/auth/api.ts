import type {
  AuthConfig,
  AuthResponse,
  ChangePasswordInput,
  LoginInput,
  LoginResponse,
  RegisterInput,
  ResetPasswordInput,
  SessionInfo,
  UpdateProfileInput,
  User,
} from "@andamo/shared";
import { apiRequest } from "@/lib/api-client";

const post = <T>(path: string, body?: unknown, anonymous = false) =>
  apiRequest<T>(path, { method: "POST", body, anonymous });

export const authApi = {
  config: () => apiRequest<AuthConfig>("/auth/config", { anonymous: true }),
  login: (input: LoginInput) => post<LoginResponse>("/auth/login", input, true),
  loginTwoFactor: (input: { mfaToken: string; code: string }) =>
    post<AuthResponse>("/auth/2fa/login", input, true),
  register: (input: RegisterInput) => post<AuthResponse>("/auth/cadastro", input, true),
  me: (signal?: AbortSignal) =>
    apiRequest<{ user: User }>("/auth/me", { signal }).then((r) => r.user),
  logout: () => post<void>("/auth/sair"),
  verifyEmail: (token: string) => post<{ user: User }>("/auth/email/verificar", { token }, true),
  resendVerification: () => post<{ ok: boolean }>("/auth/email/reenviar"),
  forgotPassword: (email: string) => post<{ ok: boolean }>("/auth/senha/esqueci", { email }, true),
  resetPassword: (input: ResetPasswordInput) => post<void>("/auth/senha/redefinir", input, true),
  googleStart: (remember: boolean) =>
    post<{ url: string }>("/auth/google/iniciar", { remember }, true),
  googleExchange: (code: string) => post<LoginResponse>("/auth/google/trocar", { code }, true),
};

export const accountApi = {
  updateProfile: (input: UpdateProfileInput) =>
    apiRequest<{ user: User }>("/conta", { method: "PATCH", body: input }).then((r) => r.user),
  changePassword: (input: ChangePasswordInput) =>
    post<{ user: User }>("/conta/senha", input).then((r) => r.user),
  sessions: () => apiRequest<{ sessions: SessionInfo[] }>("/conta/sessoes").then((r) => r.sessions),
  revokeSession: (id: string) =>
    apiRequest<void>(`/conta/sessoes/${encodeURIComponent(id)}`, { method: "DELETE" }),
  revokeOtherSessions: () => post<{ revoked: number }>("/conta/sessoes/encerrar-outras"),
  twoFactorStatus: () => apiRequest<{ recoveryCodesRemaining: number }>("/conta/2fa"),
  twoFactorSetup: () => post<{ secret: string; otpauthUrl: string }>("/conta/2fa/configurar"),
  twoFactorEnable: (code: string) =>
    post<{ user: User; recoveryCodes: string[] }>("/conta/2fa/ativar", { code }),
  twoFactorDisable: (code: string) =>
    post<{ user: User }>("/conta/2fa/desativar", { code }).then((r) => r.user),
  regenerateRecoveryCodes: (code: string) =>
    post<{ recoveryCodes: string[] }>("/conta/2fa/codigos", { code }),
  googleLink: () => post<{ url: string }>("/conta/google/vincular"),
  googleUnlink: () =>
    apiRequest<{ user: User }>("/conta/google", { method: "DELETE" }).then((r) => r.user),
};

export const isMfaChallenge = (
  r: LoginResponse,
): r is Extract<LoginResponse, { mfaRequired: true }> =>
  "mfaRequired" in r && r.mfaRequired === true;
