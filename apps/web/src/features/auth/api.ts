import type {
  AuthResponse,
  LoginInput,
  LoginResponse,
  PublicConfig,
  RegisterInput,
  Session,
  UpdateProfileInput,
  User,
} from "@andamo/shared";
import { apiRequest } from "@/lib/api-client";

const pub = { skipRefresh: true } as const;

export const authApi = {
  config: () => apiRequest<PublicConfig>("/v1/config", pub),
  login: (input: LoginInput) => apiRequest<LoginResponse>("/v1/auth/login", { ...pub, method: "POST", body: input }),
  loginMfa: (mfaToken: string, code: string) =>
    apiRequest<AuthResponse>("/v1/auth/login/2fa", { ...pub, method: "POST", body: { mfaToken, code } }),
  google: (credential: string) => apiRequest<AuthResponse>("/v1/auth/google", { ...pub, method: "POST", body: { credential } }),
  register: (input: RegisterInput) => apiRequest<AuthResponse>("/v1/auth/cadastro", { ...pub, method: "POST", body: input }),
  forgotPassword: (email: string) => apiRequest<void>("/v1/auth/esqueci-senha", { ...pub, method: "POST", body: { email } }),
  resetPassword: (token: string, password: string) =>
    apiRequest<void>("/v1/auth/redefinir-senha", { ...pub, method: "POST", body: { token, password } }),
  verifyEmail: (token: string) => apiRequest<void>("/v1/auth/verificar-email", { ...pub, method: "POST", body: { token } }),
  resendVerification: () => apiRequest<void>("/v1/auth/verificar-email/reenviar", { method: "POST" }),
  me: (signal?: AbortSignal) => apiRequest<{ user: User }>("/v1/auth/me", { signal }).then((r) => r.user),
  logout: () => apiRequest<void>("/v1/auth/logout", { method: "POST", body: {}, skipRefresh: true }),
  updateProfile: (input: UpdateProfileInput) =>
    apiRequest<{ user: User }>("/v1/auth/perfil", { method: "PATCH", body: input }).then((r) => r.user),
  completeOnboarding: () => apiRequest<{ user: User }>("/v1/auth/onboarding", { method: "POST" }).then((r) => r.user),
  changePassword: (currentPassword: string | undefined, newPassword: string) =>
    apiRequest<void>("/v1/auth/senha", { method: "POST", body: { currentPassword, newPassword } }),
  sessions: () => apiRequest<{ sessions: Session[] }>("/v1/auth/sessoes").then((r) => r.sessions),
  revokeSession: (id: string) => apiRequest<void>(`/v1/auth/sessoes/${id}`, { method: "DELETE" }),
  revokeOtherSessions: () => apiRequest<{ revoked: number }>("/v1/auth/sessoes/encerrar-outras", { method: "POST" }),
  setupTwoFactor: () => apiRequest<{ secret: string; otpauthUrl: string }>("/v1/auth/2fa/configurar", { method: "POST" }),
  enableTwoFactor: (code: string) =>
    apiRequest<{ user: User }>("/v1/auth/2fa/ativar", { method: "POST", body: { code } }).then((r) => r.user),
  disableTwoFactor: (code: string) =>
    apiRequest<{ user: User }>("/v1/auth/2fa/desativar", { method: "POST", body: { code } }).then((r) => r.user),
  exportData: () => apiRequest<unknown>("/v1/auth/exportar"),
  deleteAccount: (password: string | undefined) =>
    apiRequest<void>("/v1/auth/excluir-conta", { method: "POST", body: { password, confirmation: "EXCLUIR" } }),
};
