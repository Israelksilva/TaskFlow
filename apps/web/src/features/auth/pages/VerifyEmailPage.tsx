import { useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { StatusMessage } from "@/components/ui/status-message";
import { getErrorMessage } from "@/lib/api-client";
import { authApi } from "../api";
import { useAuth } from "../use-auth";
import { AuthLayout } from "../components/AuthLayout";

export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const { status, setUser } = useAuth();
  const verify = useMutation({
    mutationFn: authApi.verifyEmail,
    onSuccess: ({ user }) => {
      if (status === "authenticated") setUser(user);
    },
  });
  const started = useRef(false);

  // O token é de uso único: dispara uma vez só (StrictMode monta duas vezes em dev).
  useEffect(() => {
    if (token && !started.current) {
      started.current = true;
      verify.mutate(token);
    }
  }, [token, verify]);

  const next =
    status === "authenticated"
      ? { to: "/app", label: "Ir para o quadro" }
      : { to: "/entrar", label: "Entrar" };

  return (
    <AuthLayout title="Verificação de e-mail" description="Confirmando que este e-mail é seu.">
      <div className="space-y-6">
        {!token && (
          <StatusMessage tone="error">
            Link incompleto. Abra o link do e-mail novamente.
          </StatusMessage>
        )}
        {token && (verify.isIdle || verify.isPending) && (
          <StatusMessage tone="loading">Verificando…</StatusMessage>
        )}
        {verify.isSuccess && (
          <StatusMessage tone="success">E-mail confirmado. Tudo certo!</StatusMessage>
        )}
        {verify.isError && (
          <StatusMessage tone="error">
            {getErrorMessage(verify.error)} Se precisar, peça um novo link no aviso dentro do app.
          </StatusMessage>
        )}
        <Button asChild size="lg" className="w-full">
          <Link to={next.to}>{next.label}</Link>
        </Button>
      </div>
    </AuthLayout>
  );
}
