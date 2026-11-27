import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { AuthResponse, User } from "@andamo/shared";
import { onSessionChange } from "@/lib/api-client";
import { REFRESH_STORAGE_KEY, session } from "@/lib/session";
import { authApi } from "./api";
import { AuthContext, type AuthContextValue, type AuthStatus } from "./use-auth";

export const ME_KEY = ["auth", "me"] as const;

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [hasSession, setHasSession] = useState(() => session.hasSession());

  const me = useQuery({
    queryKey: ME_KEY,
    queryFn: ({ signal }) => authApi.me(signal),
    enabled: hasSession,
    staleTime: Infinity,
  });

  const clearLocal = useCallback(() => {
    session.clear();
    setHasSession(false);
    queryClient.clear();
  }, [queryClient]);

  const logout = useCallback(() => {
    // Encerra no servidor sem segurar a interface; se falhar, a sessão expira sozinha.
    if (session.hasSession()) authApi.logout().catch(() => undefined);
    clearLocal();
  }, [clearLocal]);

  const startSession = useCallback(
    (auth: AuthResponse) => {
      session.save(auth);
      queryClient.clear();
      queryClient.setQueryData(ME_KEY, auth.user);
      setHasSession(true);
    },
    [queryClient],
  );

  const setUser = useCallback(
    (user: User) => queryClient.setQueryData(ME_KEY, user),
    [queryClient],
  );

  useEffect(() => {
    onSessionChange({
      onEnd: (reason) => {
        clearLocal();
        toast.info(
          reason === "revoked"
            ? "Esta sessão foi encerrada. Entre novamente."
            : "Sua sessão expirou. Entre novamente.",
        );
      },
      onRefresh: (auth) => queryClient.setQueryData(ME_KEY, auth.user),
    });
    return () => onSessionChange(null);
  }, [clearLocal, queryClient]);

  // Saiu ou entrou em outra aba → acompanha.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== REFRESH_STORAGE_KEY) return;
      if (!event.newValue) {
        session.dropAccessToken();
        setHasSession(false);
        queryClient.clear();
      } else if (!event.oldValue) {
        setHasSession(true);
        void queryClient.invalidateQueries({ queryKey: ME_KEY });
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(() => {
    let status: AuthStatus = "unauthenticated";
    if (hasSession && me.data) status = "authenticated";
    else if (hasSession && me.isError) status = "error";
    else if (hasSession) status = "loading";
    return {
      status,
      user: me.data ?? null,
      startSession,
      setUser,
      logout,
      retry: () => void me.refetch(),
      error: me.error,
    };
  }, [hasSession, me, startSession, setUser, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
