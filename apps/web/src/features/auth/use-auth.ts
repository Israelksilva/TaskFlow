import { createContext, useContext } from "react";
import type { AuthResponse, User } from "@andamo/shared";

/** `error`: há token, mas a API não respondeu (rede/servidor) — não desloga o usuário. */
export type AuthStatus = "loading" | "authenticated" | "unauthenticated" | "error";

export interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  /** Salva a sessão retornada por login/cadastro. */
  startSession: (auth: AuthResponse) => void;
  /** Atualiza o usuário em cache (ex.: após editar o perfil). */
  setUser: (user: User) => void;
  logout: () => Promise<void>;
  retry: () => void;
  error: unknown;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de <AuthProvider>");
  return ctx;
}
