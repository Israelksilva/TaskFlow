import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { loginSchema, type LoginInput } from "@andamo/shared";
import { Button } from "@/components/ui/button";
import { InlineError } from "@/components/feedback/InlineError";
import { getErrorMessage } from "@/lib/api-client";
import { authApi } from "../api";
import { useAuth } from "../use-auth";
import { AuthLayout } from "../components/AuthLayout";
import { FormField } from "../components/FormField";

export default function LoginPage() {
  const { startSession } = useAuth();
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });
  const login = useMutation({ mutationFn: authApi.login, onSuccess: startSession });
  const { errors } = form.formState;

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
        <FormField
          label="Senha"
          type="password"
          autoComplete="current-password"
          error={errors.password?.message}
          {...form.register("password")}
        />

        {login.isError && <InlineError>{getErrorMessage(login.error)}</InlineError>}

        <Button type="submit" className="w-full" disabled={login.isPending}>
          {login.isPending && <Loader2 className="animate-spin" aria-hidden />}
          {login.isPending ? "Entrando…" : "Entrar"}
        </Button>
      </form>
    </AuthLayout>
  );
}
