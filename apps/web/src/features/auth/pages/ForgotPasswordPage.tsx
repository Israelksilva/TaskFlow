import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { forgotPasswordSchema } from "@andamo/shared";
import { Button } from "@/components/ui/button";
import { InlineError } from "@/components/feedback/InlineError";
import { StatusMessage } from "@/components/ui/status-message";
import { getErrorMessage } from "@/lib/api-client";
import { authApi } from "../api";
import { useAuthConfig } from "../use-auth";
import { AuthLayout } from "../components/AuthLayout";
import { FormField } from "../components/FormField";

const backToLogin = (
  <Link to="/entrar" className="font-medium text-primary hover:underline">
    Voltar para o login
  </Link>
);

export default function ForgotPasswordPage() {
  const config = useAuthConfig();
  const [email, setEmail] = useState("");
  const [fieldError, setFieldError] = useState<string>();
  const request = useMutation({ mutationFn: authApi.forgotPassword });

  // Sem e-mail configurado no servidor não há como enviar o link: orienta a falar conosco.
  if (config.data && !config.data.emailEnabled) {
    return (
      <AuthLayout
        title="Esqueceu a senha?"
        description="A recuperação por e-mail ainda não está ativa."
        footer={backToLogin}
      >
        <p className="text-sm text-muted-foreground">
          Enquanto isso, fale com a gente pelo{" "}
          <Link
            to="/"
            state={{ scrollTo: "contato" }}
            className="font-medium text-primary hover:underline"
          >
            formulário de contato
          </Link>{" "}
          usando o e-mail da sua conta, e ajudamos você a recuperar o acesso.
        </p>
      </AuthLayout>
    );
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = forgotPasswordSchema.safeParse({ email });
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message);
      return;
    }
    setFieldError(undefined);
    if (!request.isPending) request.mutate(parsed.data.email);
  }

  return (
    <AuthLayout
      title="Esqueceu a senha?"
      description="Informe o e-mail da conta e enviaremos um link para criar uma nova senha."
      footer={backToLogin}
    >
      {request.isSuccess ? (
        <StatusMessage tone="success">
          Se houver uma conta com {email.trim().toLowerCase()}, você receberá o link em instantes.
          Ele vale por 30 minutos.
        </StatusMessage>
      ) : (
        <form noValidate className="space-y-4" onSubmit={submit}>
          <FormField
            label="E-mail"
            type="email"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={fieldError}
          />
          {request.isError && <InlineError>{getErrorMessage(request.error)}</InlineError>}
          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={request.isPending || config.isLoading}
          >
            {request.isPending && <Loader2 className="animate-spin" aria-hidden />}
            Enviar link
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
