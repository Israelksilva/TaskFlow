import type { AuthResponse, LoginInput, RegisterInput, User } from "@andamo/shared";
import { apiRequest } from "@/lib/api-client";

export const authApi = {
  login: (input: LoginInput) => apiRequest<AuthResponse>("/auth/login", { method: "POST", body: input }),
  register: (input: RegisterInput) =>
    apiRequest<AuthResponse>("/auth/cadastro", { method: "POST", body: input }),
  me: (signal?: AbortSignal) => apiRequest<{ user: User }>("/auth/me", { signal }).then((r) => r.user),
};
