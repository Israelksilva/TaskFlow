import { Navigate, Outlet, useLocation } from "react-router-dom";
import { LoadingScreen } from "@/components/feedback/LoadingScreen";
import { InlineError } from "@/components/feedback/InlineError";
import { Button } from "@/components/ui/button";
import { getErrorMessage } from "@/lib/api-client";
import { useAuth } from "./use-auth";

function SessionError() {
  const { error, retry, logout } = useAuth();
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md space-y-3">
        <InlineError>{getErrorMessage(error)}</InlineError>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={logout}>
            Sair
          </Button>
          <Button onClick={retry}>Tentar novamente</Button>
        </div>
      </div>
    </div>
  );
}

/** Exige sessão ativa; caso contrário redireciona para /entrar. */
export function RequireAuth() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === "loading") return <LoadingScreen label="Carregando sua conta…" />;
  if (status === "error") return <SessionError />;
  if (status === "unauthenticated") {
    return <Navigate to="/entrar" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}

/** Páginas de login/cadastro: quem já está logado vai direto para o quadro. */
export function GuestOnly() {
  const { status } = useAuth();
  if (status === "loading") return <LoadingScreen label="Carregando…" />;
  if (status === "authenticated") return <Navigate to="/" replace />;
  return <Outlet />;
}
