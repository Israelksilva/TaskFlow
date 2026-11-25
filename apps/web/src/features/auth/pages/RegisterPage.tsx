import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { z } from "zod";
import { LIMITS, registerSchema } from "@andamo/shared";
import { Button } from "@/components/ui/button";
import { InlineError } from "@/components/feedback/InlineError";
import { ApiError, getErrorMessage } from "@/lib/api-client";
import { authApi } from "../api";
import { useAuth } from "../use-auth";
import { AuthLayout } from "../components/AuthLayout";
import { FormField } from "../components/FormField";

const formSchema = registerSchema
  .extend({ confirmPassword: z.string().min(1, "Confirme a senha") })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "As senhas não conferem",
  });

type FormValues = z.infer<typeof formSchema>;

export default function RegisterPage() {
  const { startSession } = useAuth();
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
  });
  const register = useMutation({
    mutationFn: authApi.register,
    onSuccess: startSession,
    onError: (error) => {
      // Erros por campo vindos do servidor aparecem junto ao campo.
      if (error instanceof ApiError && error.code === "EMAIL_IN_USE") {
        form.setError("email", { message: error.message }, { shouldFocus: true });
      }
    },
  });
  const { errors } = form.formState;
  const showGenericError =
    register.isError && !(register.error instanceof ApiError && register.error.code === "EMAIL_IN_USE");

  return (
    <AuthLayout
      title="Criar conta"
      description="Suas tarefas ficam salvas com segurança na nuvem."
      footer={
        <>
          Já tem conta?{" "}
          <Link to="/entrar" className="font-medium text-primary hover:underline">
            Entrar
          </Link>
        </>
      }
    >
      <form
        noValidate
        className="space-y-4"
        onSubmit={form.handleSubmit(
          ({ confirmPassword: _c, ...values }) => !register.isPending && register.mutate(values),
        )}
      >
        <FormField label="Nome" autoComplete="name" autoFocus error={errors.name?.message} {...form.register("name")} />
        <FormField label="E-mail" type="email" autoComplete="email" error={errors.email?.message} {...form.register("email")} />
        <FormField
          label="Senha"
          type="password"
          autoComplete="new-password"
          hint={`Mínimo de ${LIMITS.passwordMin} caracteres, com letras e números.`}
          error={errors.password?.message}
          {...form.register("password")}
        />
        <FormField
          label="Confirmar senha"
          type="password"
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          {...form.register("confirmPassword")}
        />

        {showGenericError && <InlineError>{getErrorMessage(register.error)}</InlineError>}

        <Button type="submit" size="lg" className="w-full" disabled={register.isPending}>
          {register.isPending && <Loader2 className="animate-spin" aria-hidden />}
          {register.isPending ? "Criando conta…" : "Criar conta"}
        </Button>
      </form>
    </AuthLayout>
  );
}
