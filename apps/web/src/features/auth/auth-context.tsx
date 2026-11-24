import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { AuthResponse } from "@andamo/shared";
import { onUnauthorized } from "@/lib/api-client";
import { tokenStorage } from "@/lib/storage";
import { authApi } from "./api";
import { AuthContext, type AuthContextValue, type AuthStatus } from "./use-auth";

const ME_KEY = ["auth", "me"] as const;

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [token, setToken] = useState(() => tokenStorage.get());

  const me = useQuery({
    queryKey: ME_KEY,
    queryFn: ({ signal }) => authApi.me(signal),
    enabled: Boolean(token),
    staleTime: Infinity,
  });

  const logout = useCallback(() => {
    tokenStorage.remove();
    setToken(null);
    queryClient.clear();
  }, [queryClient]);

  const startSession = useCallback(
    ({ token: newToken, user }: AuthResponse) => {
      tokenStorage.set(newToken);
      queryClient.clear();
      queryClient.setQueryData(ME_KEY, user);
      setToken(newToken);
    },
    [queryClient],
  );

  // Token expirado/inválido em qualquer requisição → encerra a sessão.
  useEffect(() => {
    onUnauthorized(logout);
    return () => onUnauthorized(null);
  }, [logout]);

  const value = useMemo<AuthContextValue>(() => {
    let status: AuthStatus = "unauthenticated";
    if (token && me.data) status = "authenticated";
    else if (token && me.isError) status = "error";
    else if (token) status = "loading";
    return { status, user: me.data ?? null, startSession, logout, retry: () => void me.refetch(), error: me.error };
  }, [token, me, startSession, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
