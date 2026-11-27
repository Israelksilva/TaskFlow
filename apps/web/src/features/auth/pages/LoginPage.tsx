import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import type { z } from "zod";
import { loginSchema, type LoginInput } from "@andamo/shared";
import { Button } from "@/components/ui/button";
import { InlineError } from "@/components/feedback/InlineError";
import { getErrorMessage } from "@/lib/api-client";
import { authApi, isMfaChallenge } from "../api";
import { useAuth, useAuthConfig } from "../use-auth";
import { AuthLayout } from "../components/AuthLayout";
import { FormField } from "../components/FormField";
import { PasswordField } from "../components/PasswordField";
import { Divider, GoogleButton, RememberCheckbox } from "../components/AuthExtras";
import { GOOGLE_ERRORS } from "../google-errors";
import { TwoFactorStep } from "../components/TwoFactorStep";

export default function LoginPage() {
  const { startSession } = useAuth();
  const config = useAuthConfig();
  const [params] = useSearchParams();
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const form = useForm<z.input<typeof loginSchema>, unknown, LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", remember: false },
  });
  const remember = form.watch("remember") ?? false;
  const login = useMutation({
    mutationFn: authApi.login,
    onSuccess: (result) =>
      isMfaChallenge(result) ? setMfaToken(result.mfaToken) : startSession(result),
  });
  const { errors } = form.formState;
  const urlError = GOOGLE_ERRORS[params.get("erro") ?? ""];

  if (mfaToken) {
    return (
      <AuthLayout
        title="Verificação em duas etapas"
        description="Mais uma etapa para proteger sua conta."
        footer={null}
      >
        <TwoFactorStep mfaToken={mfaToken} onCancel={() => setMfaToken(null)} />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Entrar"
      description="Acesse suas tarefas em qualquer dispositivo."
      footer={
        <>
          Ainda não tem conta?{" "}
          <Link to="/cadastro" className="font-medium text-primary hover:underline">
            Criar conta
          </Link>
        </>
      }
    >
      {urlError && <InlineError className="mb-4">{urlError}</InlineError>}
      <form
        noValidate
        className="space-y-4"
        onSubmit={form.handleSubmit((values) => !login.isPending && login.mutate(values))}
      >
        <FormField
          label="E-mail"
          type="email"
          autoComplete="email"
          autoFocus
          error={errors.email?.message}
          {...form.register("email")}
        />
        <div className="space-y-1.5">
          <PasswordField
            label="Senha"
            autoComplete="current-password"
            error={errors.password?.message}
            {...form.register("password")}
          />
          <div className="text-right">
            <Link to="/esqueci-senha" className="text-sm font-medium text-primary hover:underline">
              Esqueceu a senha?
            </Link>
          </div>
        </div>
        <RememberCheckbox checked={remember} onChange={(v) => form.setValue("remember", v)} />

        {login.isError && <InlineError>{getErrorMessage(login.error)}</InlineError>}

        <Button type="submit" size="lg" className="w-full" disabled={login.isPending}>
          {login.isPending && <Loader2 className="animate-spin" aria-hidden />}
          {login.isPending ? "Entrando…" : "Entrar"}
        </Button>
      </form>

      {config.data?.googleEnabled && (
        <div className="mt-6 space-y-4">
          <Divider>ou</Divider>
          <GoogleButton remember={remember} />
        </div>
      )}
    </AuthLayout>
  );
}
