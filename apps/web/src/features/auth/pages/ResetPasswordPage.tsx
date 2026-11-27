import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { LIMITS, passwordSchema } from "@andamo/shared";
import { Button } from "@/components/ui/button";
import { InlineError } from "@/components/feedback/InlineError";
import { getErrorMessage } from "@/lib/api-client";
import { authApi } from "../api";
import { useAuth } from "../use-auth";
import { AuthLayout } from "../components/AuthLayout";
import { PasswordField } from "../components/PasswordField";

const formSchema = z
  .object({ password: passwordSchema, confirmPassword: z.string().min(1, "Confirme a senha") })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "As senhas não conferem",
  });
type FormValues = z.infer<typeof formSchema>;

const forgotLink = (
  <Link to="/esqueci-senha" className="font-medium text-primary hover:underline">
    Pedir um novo link
  </Link>
);

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const navigate = useNavigate();
  const { status, logout } = useAuth();
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });
  const reset = useMutation({
    mutationFn: authApi.resetPassword,
    onSuccess: () => {
      // Todas as sessões foram encerradas no servidor, inclusive a deste navegador.
      if (status !== "unauthenticated") logout();
      toast.success("Senha redefinida. Entre com a nova senha.");
      navigate("/entrar", { replace: true });
    },
  });
  const { errors } = form.formState;
  const password = form.watch("password");

  if (!token) {
    return (
      <AuthLayout
        title="Link inválido"
        description="Este link de redefinição está incompleto."
        footer={forgotLink}
      >
        <InlineError>Abra o link do e-mail novamente ou peça um novo.</InlineError>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Criar nova senha"
      description="Ao salvar, você sai de todos os dispositivos."
      footer={forgotLink}
    >
      <form
        noValidate
        className="space-y-4"
        onSubmit={form.handleSubmit(
          ({ password }) => !reset.isPending && reset.mutate({ token, password }),
        )}
      >
        <PasswordField
          label="Nova senha"
          autoComplete="new-password"
          autoFocus
          hint={`Mínimo de ${LIMITS.passwordMin} caracteres, com letras e números.`}
          strengthOf={password}
          error={errors.password?.message}
          {...form.register("password")}
        />
        <PasswordField
          label="Confirmar nova senha"
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          {...form.register("confirmPassword")}
        />
        {reset.isError && <InlineError>{getErrorMessage(reset.error)}</InlineError>}
        <Button type="submit" size="lg" className="w-full" disabled={reset.isPending}>
          {reset.isPending && <Loader2 className="animate-spin" aria-hidden />}
          Salvar nova senha
        </Button>
      </form>
    </AuthLayout>
  );
}
