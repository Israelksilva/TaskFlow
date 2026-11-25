import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { AuthResponse, User } from "@andamo/shared";
import { onSessionRefreshed, onUnauthorized, saveTokens } from "@/lib/api-client";
import { clearLocalUserData, refreshStorage, tokenStorage } from "@/lib/storage";
import { authApi } from "./api";
import { AuthContext, type AuthContextValue, type AuthStatus } from "./use-auth";

export const ME_KEY = ["auth", "me"] as const;

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  // Sessões antigas (só access token, sem refresh) são descartadas: o usuário entra de novo.
  const [token, setToken] = useState(() => (refreshStorage.get() ? tokenStorage.get() : null));

  const me = useQuery({
    queryKey: ME_KEY,
    queryFn: ({ signal }) => authApi.me(signal),
    enabled: Boolean(token),
    staleTime: Infinity,
  });

  const clear = useCallback(async () => {
    tokenStorage.remove();
    refreshStorage.remove();
    setToken(null);
    queryClient.clear();
    await clearLocalUserData();
  }, [queryClient]);

  const logout = useCallback(async () => {
    // Encerra a sessão também no servidor (o refresh token deixa de valer).
    await authApi.logout().catch(() => undefined);
    await clear();
  }, [clear]);

  const startSession = useCallback(
    (auth: AuthResponse) => {
      saveTokens(auth);
      queryClient.clear();
      queryClient.setQueryData(ME_KEY, auth.user);
      setToken(auth.token);
    },
    [queryClient],
  );

  const setUser = useCallback((user: User) => queryClient.setQueryData(ME_KEY, user), [queryClient]);

  // Sessão que não pode ser renovada → encerra localmente.
  useEffect(() => {
    onUnauthorized(() => void clear());
    onSessionRefreshed((auth) => queryClient.setQueryData(ME_KEY, auth.user));
    return () => {
      onUnauthorized(null);
      onSessionRefreshed(null);
    };
  }, [clear, queryClient]);

  // Logout em outra aba: sincroniza.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "andamo:refresh" && !e.newValue) void clear();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [clear]);

  const value = useMemo<AuthContextValue>(() => {
    let status: AuthStatus = "unauthenticated";
    if (token && me.data) status = "authenticated";
    else if (token && me.isError) status = "error";
    else if (token) status = "loading";
    return { status, user: me.data ?? null, startSession, setUser, logout, retry: () => void me.refetch(), error: me.error };
  }, [token, me, startSession, setUser, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
