import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { StatusMessage } from "@/components/ui/status-message";
import { getErrorMessage } from "@/lib/api-client";
import { authApi, isMfaChallenge } from "../api";
import { useAuth } from "../use-auth";
import { AuthLayout } from "../components/AuthLayout";
import { TwoFactorStep } from "../components/TwoFactorStep";

/** Volta do Google: troca o código de uso único (60 s) pela sessão. */
export default function GoogleCallbackPage() {
  const [params] = useSearchParams();
  const code = params.get("codigo") ?? "";
  const { status, startSession } = useAuth();
  const navigate = useNavigate();
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const exchange = useMutation({
    mutationFn: authApi.googleExchange,
    onSuccess: (result) =>
      isMfaChallenge(result) ? setMfaToken(result.mfaToken) : startSession(result),
  });
  const started = useRef(false);

  useEffect(() => {
    if (code && !started.current) {
      started.current = true;
      exchange.mutate(code);
    }
  }, [code, exchange]);

  if (status === "authenticated") return <Navigate to="/app" replace />;
  if (!code) return <Navigate to="/entrar?erro=google_falha" replace />;

  if (mfaToken) {
    return (
      <AuthLayout
        title="Verificação em duas etapas"
        description="Mais uma etapa para proteger sua conta."
      >
        <TwoFactorStep
          mfaToken={mfaToken}
          onCancel={() => navigate("/entrar", { replace: true })}
        />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Entrando com Google"
      description="Só um instante."
      footer={
        exchange.isError ? (
          <Link to="/entrar" className="font-medium text-primary hover:underline">
            Voltar para o login
          </Link>
        ) : null
      }
    >
      {exchange.isError ? (
        <StatusMessage tone="error">{getErrorMessage(exchange.error)}</StatusMessage>
      ) : (
        <StatusMessage tone="loading">Abrindo sua conta…</StatusMessage>
      )}
    </AuthLayout>
  );
}
