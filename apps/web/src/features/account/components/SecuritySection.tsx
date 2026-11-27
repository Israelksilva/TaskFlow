import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, Loader2, MailWarning } from "lucide-react";
import { toast } from "sonner";
import type { User } from "@andamo/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { accountApi, authApi } from "@/features/auth/api";
import { useAuth, useAuthConfig } from "@/features/auth/use-auth";
import { getErrorMessage } from "@/lib/api-client";
import { Section } from "./Section";

/** Status do e-mail (com reenvio do link) e conexão com o Google. */
export function EmailSection({ user }: { user: User }) {
  const config = useAuthConfig();
  const resend = useMutation({
    mutationFn: authApi.resendVerification,
    onSuccess: () => toast.success(`Enviamos um novo link para ${user.email}.`),
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  return (
    <Section title="E-mail" description={user.email}>
      {user.emailVerified ? (
        <Badge variant="secondary" className="gap-1">
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Verificado
        </Badge>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="secondary" className="gap-1">
            <MailWarning className="h-3.5 w-3.5" aria-hidden /> Não verificado
          </Badge>
          {config.data?.emailEnabled && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => resend.mutate()}
              disabled={resend.isPending}
            >
              {resend.isPending && <Loader2 className="animate-spin" aria-hidden />}
              Reenviar link de verificação
            </Button>
          )}
        </div>
      )}
    </Section>
  );
}

export function GoogleSection({ user }: { user: User }) {
  const config = useAuthConfig();
  const { setUser } = useAuth();
  const link = useMutation({
    mutationFn: accountApi.googleLink,
    onSuccess: ({ url }) => window.location.assign(url),
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  const unlink = useMutation({
    mutationFn: accountApi.googleUnlink,
    onSuccess: (updated) => {
      setUser(updated);
      toast.success("Conta Google desconectada.");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  // Sem credenciais do Google no servidor, a seção só aparece para quem já tem vínculo.
  if (!config.data?.googleEnabled && !user.googleLinked) return null;

  return (
    <Section title="Google" description="Entre com um clique usando sua conta Google.">
      {user.googleLinked ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="secondary" className="gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Conectado
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => unlink.mutate()}
              disabled={!user.hasPassword || unlink.isPending}
            >
              {unlink.isPending && <Loader2 className="animate-spin" aria-hidden />}
              Desconectar
            </Button>
          </div>
          {!user.hasPassword && (
            <p className="text-xs text-muted-foreground">
              Defina uma senha antes de desconectar, para não perder o acesso.
            </p>
          )}
        </div>
      ) : (
        <Button variant="outline" onClick={() => link.mutate()} disabled={link.isPending}>
          {link.isPending && <Loader2 className="animate-spin" aria-hidden />}
          Conectar conta Google
        </Button>
      )}
    </Section>
  );
}
