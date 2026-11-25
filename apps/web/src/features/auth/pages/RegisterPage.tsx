import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { z } from "zod";
import { registerSchema } from "@andamo/shared";
import { Button } from "@/components/ui/button";
import { InlineError } from "@/components/feedback/InlineError";
import { ApiError, getErrorMessage } from "@/lib/api-client";
import { authApi } from "../api";
import { useAuth } from "../use-auth";
import { AuthLayout } from "../components/AuthLayout";
import { FormField } from "../components/FormField";
import { GoogleButton } from "../components/GoogleButton";
import { PasswordStrengthMeter } from "../components/PasswordStrength";

const formSchema = registerSchema
  .extend({
    confirmPassword: z.string().min(1, "Confirme a senha"),
    terms: z.literal(true, { errorMap: () => ({ message: "Aceite os termos para continuar" }) }),
  })
  .refine((v) => v.password === v.confirmPassword, { path: ["confirmPassword"], message: "As senhas não conferem" });

type FormValues = z.input<typeof formSchema>;

export default function RegisterPage() {
  const { startSession } = useAuth();
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", email: "", password: "", confirmPassword: "", terms: false as unknown as true },
  });
  const register = useMutation({
    mutationFn: authApi.register,
    onSuccess: startSession,
    onError: (error) => {
      if (error instanceof ApiError && error.code === "EMAIL_IN_USE") form.setError("email", { message: error.message }, { shouldFocus: true });
    },
  });
  const google = useMutation({ mutationFn: authApi.google, onSuccess: startSession });
  const { errors } = form.formState;
  const password = form.watch("password");
  const showGenericError = register.isError && !(register.error instanceof ApiError && register.error.code === "EMAIL_IN_USE");

  return (
    <AuthLayout
      title="Criar conta"
      description="Grátis para começar. Sem cartão de crédito."
      footer={
        <>
          Já tem conta?{" "}
          <Link to="/entrar" className="font-medium text-primary hover:underline">
            Entrar
          </Link>
        </>
      }
    >
      <GoogleButton text="signup_with" onCredential={(c) => google.mutate(c)} />
      {google.isError && <InlineError className="mb-4">{getErrorMessage(google.error)}</InlineError>}
      <form
        noValidate
        className="space-y-4"
        onSubmit={form.handleSubmit(({ name, email, password: pw }) => !register.isPending && register.mutate({ name, email, password: pw }))}
      >
        <FormField label="Nome" autoComplete="name" autoFocus error={errors.name?.message} {...form.register("name")} />
        <FormField label="E-mail" type="email" autoComplete="email" error={errors.email?.message} {...form.register("email")} />
        <div className="space-y-1.5">
          <FormField label="Senha" type="password" autoComplete="new-password" error={errors.password?.message} {...form.register("password")} />
          <PasswordStrengthMeter password={password} />
        </div>
        <FormField label="Confirmar senha" type="password" autoComplete="new-password" error={errors.confirmPassword?.message} {...form.register("confirmPassword")} />
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[hsl(var(--primary))]" {...form.register("terms")} />
          <span>
            Li e aceito os{" "}
            <Link to="/termos" target="_blank" className="font-medium text-primary hover:underline">termos de uso</Link> e a{" "}
            <Link to="/privacidade" target="_blank" className="font-medium text-primary hover:underline">política de privacidade</Link>.
          </span>
        </label>
        {errors.terms && <p className="-mt-2 text-xs font-medium text-destructive">{errors.terms.message}</p>}
        {showGenericError && <InlineError>{getErrorMessage(register.error)}</InlineError>}
        <Button type="submit" className="w-full bg-brand text-white hover:brightness-110" disabled={register.isPending}>
          {register.isPending && <Loader2 className="animate-spin" aria-hidden />}
          {register.isPending ? "Criando conta…" : "Criar conta"}
        </Button>
      </form>
    </AuthLayout>
  );
}
