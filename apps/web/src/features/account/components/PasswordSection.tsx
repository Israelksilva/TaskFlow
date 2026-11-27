import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { LIMITS, passwordSchema, type User } from "@andamo/shared";
import { Button } from "@/components/ui/button";
import { InlineError } from "@/components/feedback/InlineError";
import { PasswordField } from "@/features/auth/components/PasswordField";
import { accountApi } from "@/features/auth/api";
import { useAuth } from "@/features/auth/use-auth";
import { ApiError, getErrorMessage } from "@/lib/api-client";
import { Section } from "./Section";

const schema = (hasPassword: boolean) =>
  z
    .object({
      currentPassword: hasPassword
        ? z.string().min(1, "Informe a senha atual")
        : z.string().optional(),
      newPassword: passwordSchema,
      confirmPassword: z.string().min(1, "Confirme a nova senha"),
    })
    .refine((v) => v.newPassword === v.confirmPassword, {
      path: ["confirmPassword"],
      message: "As senhas não conferem",
    })
    .refine((v) => !hasPassword || v.currentPassword !== v.newPassword, {
      path: ["newPassword"],
      message: "A nova senha deve ser diferente da atual",
    });
type Values = z.infer<ReturnType<typeof schema>>;

export function PasswordSection({ user }: { user: User }) {
  const { setUser } = useAuth();
  const queryClient = useQueryClient();
  const form = useForm<Values>({
    resolver: zodResolver(schema(user.hasPassword)),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });
  const change = useMutation({
    mutationFn: accountApi.changePassword,
    onSuccess: (updated) => {
      setUser(updated);
      form.reset();
      void queryClient.invalidateQueries({ queryKey: ["account", "sessions"] });
      toast.success(
        user.hasPassword
          ? "Senha alterada. Os outros dispositivos foram desconectados."
          : "Senha definida.",
      );
    },
    onError: (error) => {
      if (error instanceof ApiError && error.details?.currentPassword) {
        form.setError(
          "currentPassword",
          { message: error.details.currentPassword[0] },
          { shouldFocus: true },
        );
      }
    },
  });
  const { errors } = form.formState;
  const newPassword = form.watch("newPassword");
  const fieldErrorShown =
    change.error instanceof ApiError && Boolean(change.error.details?.currentPassword);

  return (
    <Section
      title={user.hasPassword ? "Senha" : "Definir senha"}
      description={
        user.hasPassword
          ? "Ao trocar, os outros dispositivos conectados são desconectados."
          : "Sua conta usa só o Google. Defina uma senha para também entrar com e-mail."
      }
    >
      <form
        noValidate
        className="space-y-4"
        onSubmit={form.handleSubmit(
          ({ currentPassword, newPassword }) =>
            !change.isPending &&
            change.mutate({ newPassword, ...(user.hasPassword ? { currentPassword } : {}) }),
        )}
      >
        {user.hasPassword && (
          <PasswordField
            label="Senha atual"
            autoComplete="current-password"
            error={errors.currentPassword?.message}
            {...form.register("currentPassword")}
          />
        )}
        <PasswordField
          label="Nova senha"
          autoComplete="new-password"
          hint={`Mínimo de ${LIMITS.passwordMin} caracteres, com letras e números.`}
          strengthOf={newPassword}
          strengthContext={[user.name, user.email.split("@")[0] ?? ""]}
          error={errors.newPassword?.message}
          {...form.register("newPassword")}
        />
        <PasswordField
          label="Confirmar nova senha"
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          {...form.register("confirmPassword")}
        />
        {change.isError && !fieldErrorShown && (
          <InlineError>{getErrorMessage(change.error)}</InlineError>
        )}
        <div className="flex justify-end">
          <Button type="submit" disabled={change.isPending}>
            {change.isPending && <Loader2 className="animate-spin" aria-hidden />}
            {user.hasPassword ? "Alterar senha" : "Definir senha"}
          </Button>
        </div>
      </form>
    </Section>
  );
}
