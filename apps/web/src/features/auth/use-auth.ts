import { createContext, useContext } from "react";
import { useQuery } from "@tanstack/react-query";
import type { AuthResponse, User } from "@andamo/shared";
import { authApi } from "./api";

/** `error`: há sessão, mas a API não respondeu (rede/servidor) — não desloga o usuário. */
export type AuthStatus = "loading" | "authenticated" | "unauthenticated" | "error";

export interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  /** Salva a sessão retornada por login/cadastro/2FA/Google. */
  startSession: (auth: AuthResponse) => void;
  /** Atualiza o usuário em cache após uma mudança na conta. */
  setUser: (user: User) => void;
  /** Encerra a sessão no servidor (melhor esforço) e no navegador. */
  logout: () => void;
  retry: () => void;
  error: unknown;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de <AuthProvider>");
  return ctx;
}

/** Recursos que dependem de configuração do servidor (e-mail, Google). */
export function useAuthConfig() {
  return useQuery({
    queryKey: ["auth", "config"],
    queryFn: authApi.config,
    staleTime: Infinity,
    retry: 1,
  });
}
