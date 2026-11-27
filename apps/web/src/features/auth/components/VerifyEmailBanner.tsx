import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { MailWarning, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getErrorMessage } from "@/lib/api-client";
import { authApi } from "../api";
import { useAuth, useAuthConfig } from "../use-auth";

const DISMISS_KEY = "andamo:verify-banner-dismissed";

function readDismissed() {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

/** Aviso de e-mail não verificado. Só aparece quando o servidor consegue enviar e-mails. */
export function VerifyEmailBanner() {
  const { user } = useAuth();
  const config = useAuthConfig();
  const [dismissed, setDismissed] = useState(readDismissed);
  const resend = useMutation({
    mutationFn: authApi.resendVerification,
    onSuccess: () => toast.success(`Enviamos um novo link para ${user?.email}.`),
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  if (!user || user.emailVerified || !config.data?.emailEnabled || dismissed) return null;

  function dismiss() {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* armazenamento indisponível */
    }
  }

  return (
    <div
      role="region"
      aria-label="Verificação de e-mail"
      className="flex items-center gap-3 border-b bg-warning/10 px-3 py-2 text-sm sm:px-5"
    >
      <MailWarning className="h-4 w-4 shrink-0 text-warning" aria-hidden />
      <p className="flex-1">
        Confirme seu e-mail <strong className="font-semibold">{user.email}</strong> pelo link que
        enviamos.
      </p>
      <Button
        variant="outline"
        size="sm"
        onClick={() => resend.mutate()}
        disabled={resend.isPending}
      >
        Reenviar
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        aria-label="Dispensar aviso"
        onClick={dismiss}
      >
        <X aria-hidden />
      </Button>
    </div>
  );
}
