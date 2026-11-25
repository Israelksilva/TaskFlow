import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Loader2, ShieldCheck } from "lucide-react";
import { loginSchema, type AuthResponse, type LoginInput } from "@andamo/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InlineError } from "@/components/feedback/InlineError";
import { getErrorMessage } from "@/lib/api-client";
import { authApi } from "../api";
import { useAuth } from "../use-auth";
import { AuthLayout } from "../components/AuthLayout";
import { FormField } from "../components/FormField";
import { GoogleButton } from "../components/GoogleButton";

function MfaStep({ mfaToken, onDone, onBack }: { mfaToken: string; onDone: (a: AuthResponse) => void; onBack: () => void }) {
  const [code, setCode] = useState("");
  const verify = useMutation({ mutationFn: () => authApi.loginMfa(mfaToken, code), onSuccess: onDone });
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (code.length === 6 && !verify.isPending) verify.mutate();
      }}
    >
      <div className="flex items-center gap-3 rounded-lg bg-primary/5 p-3 text-sm">
        <ShieldCheck className="h-5 w-5 shrink-0 text-primary" aria-hidden />
        Abra o aplicativo autenticador e digite o código de 6 dígitos.
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="mfa-code">Código</Label>
        <Input
          id="mfa-code"
          autoFocus
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          className="text-center font-mono text-lg tracking-[0.5em]"
        />
      </div>
      {verify.isError && <InlineError>{getErrorMessage(verify.error)}</InlineError>}
      <Button type="submit" className="w-full" disabled={code.length !== 6 || verify.isPending}>
        {verify.isPending && <Loader2 className="animate-spin" aria-hidden />} Verificar
      </Button>
      <Button type="button" variant="ghost" className="w-full" onClick={onBack}>
        Voltar
      </Button>
    </form>
  );
}

export default function LoginPage() {
  const { startSession } = useAuth();
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const form = useForm<LoginInput>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });
  const login = useMutation({
    mutationFn: authApi.login,
    onSuccess: (r) => ("mfaRequired" in r ? setMfaToken(r.mfaToken) : startSession(r)),
  });
  const google = useMutation({ mutationFn: authApi.google, onSuccess: startSession });
  const { errors } = form.formState;

  return (
    <AuthLayout
      title={mfaToken ? "Verificação em duas etapas" : "Entrar"}
      description={mfaToken ? "Sua conta tem uma camada extra de proteção." : "Acesse seus projetos em qualquer dispositivo."}
      footer={
        <>
          Ainda não tem conta?{" "}
          <Link to="/cadastro" className="font-medium text-primary hover:underline">
            Criar conta grátis
          </Link>
        </>
      }
    >
      {mfaToken ? (
        <MfaStep mfaToken={mfaToken} onDone={startSession} onBack={() => setMfaToken(null)} />
      ) : (
        <>
          <GoogleButton onCredential={(c) => google.mutate(c)} />
          {google.isError && <InlineError className="mb-4">{getErrorMessage(google.error)}</InlineError>}
          <form noValidate className="space-y-4" onSubmit={form.handleSubmit((values) => !login.isPending && login.mutate(values))}>
            <FormField label="E-mail" type="email" autoComplete="email" autoFocus error={errors.email?.message} {...form.register("email")} />
            <div className="space-y-1">
              <FormField label="Senha" type="password" autoComplete="current-password" error={errors.password?.message} {...form.register("password")} />
              <div className="text-right">
                <Link to="/esqueci-senha" className="text-xs font-medium text-primary hover:underline">
                  Esqueci minha senha
                </Link>
              </div>
            </div>
            {login.isError && <InlineError>{getErrorMessage(login.error)}</InlineError>}
            <Button type="submit" className="w-full bg-brand text-white hover:brightness-110" disabled={login.isPending}>
              {login.isPending && <Loader2 className="animate-spin" aria-hidden />}
              {login.isPending ? "Entrando…" : "Entrar"}
            </Button>
          </form>
        </>
      )}
    </AuthLayout>
  );
}
