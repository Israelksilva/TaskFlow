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
          <Button variant="ghost" onClick={() => void logout()}>
            Sair
          </Button>
          <Button onClick={retry}>Tentar novamente</Button>
        </div>
      </div>
    </div>
  );
}

/** Exige sessão ativa; caso contrário redireciona para /entrar (voltando à página pedida depois). */
export function RequireAuth() {
  const { status, user } = useAuth();
  const location = useLocation();

  if (status === "loading") return <LoadingScreen label="Carregando sua conta…" />;
  if (status === "error") return <SessionError />;
  if (status === "unauthenticated") {
    return <Navigate to="/entrar" replace state={{ from: location.pathname + location.search }} />;
  }
  // Novos usuários passam pelo onboarding antes do app.
  if (user && !user.onboarded && location.pathname !== "/boas-vindas") return <Navigate to="/boas-vindas" replace />;
  return <Outlet />;
}

/** Páginas de login/cadastro: quem já está logado vai direto para o app (ou para onde ia). */
export function GuestOnly() {
  const { status } = useAuth();
  const location = useLocation();
  if (status === "loading") return <LoadingScreen label="Carregando…" />;
  if (status === "authenticated") {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from && from.startsWith("/app") ? from : "/app"} replace />;
  }
  return <Outlet />;
}

/** Painel da plataforma: somente administradores do Andamo (validado também no servidor). */
export function RequirePlatformAdmin() {
  const { user } = useAuth();
  if (!user?.isPlatformAdmin) return <Navigate to="/app" replace />;
  return <Outlet />;
}
