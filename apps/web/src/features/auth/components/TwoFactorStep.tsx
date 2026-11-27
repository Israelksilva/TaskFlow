import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { mfaCodeSchema } from "@andamo/shared";
import { Button } from "@/components/ui/button";
import { InlineError } from "@/components/feedback/InlineError";
import { getErrorMessage } from "@/lib/api-client";
import { authApi } from "../api";
import { useAuth } from "../use-auth";
import { FormField } from "./FormField";

/** Segunda etapa do login: código do app autenticador ou de recuperação. */
export function TwoFactorStep({ mfaToken, onCancel }: { mfaToken: string; onCancel: () => void }) {
  const { startSession } = useAuth();
  const [code, setCode] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);
  const [fieldError, setFieldError] = useState<string>();
  const verify = useMutation({ mutationFn: authApi.loginTwoFactor, onSuccess: startSession });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = mfaCodeSchema.safeParse(code);
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? "Código inválido");
      return;
    }
    setFieldError(undefined);
    if (!verify.isPending) verify.mutate({ mfaToken, code: parsed.data });
  }

  return (
    <form noValidate className="space-y-4" onSubmit={submit}>
      <p className="text-sm text-muted-foreground">
        {useRecovery
          ? "Digite um dos códigos de recuperação que você guardou. Cada código vale uma vez."
          : "Abra seu app autenticador e digite o código de 6 dígitos do Andamo."}
      </p>
      <FormField
        key={useRecovery ? "recovery" : "totp"}
        label={useRecovery ? "Código de recuperação" : "Código de verificação"}
        autoComplete="one-time-code"
        inputMode={useRecovery ? "text" : "numeric"}
        placeholder={useRecovery ? "XXXXX-XXXXX" : "000000"}
        autoFocus
        value={code}
        onChange={(e) => setCode(e.target.value)}
        error={fieldError}
      />
      {verify.isError && <InlineError>{getErrorMessage(verify.error)}</InlineError>}
      <Button type="submit" size="lg" className="w-full" disabled={verify.isPending}>
        {verify.isPending && <Loader2 className="animate-spin" aria-hidden />}
        Verificar
      </Button>
      <div className="flex justify-between text-sm">
        <button
          type="button"
          className="font-medium text-primary hover:underline"
          onClick={onCancel}
        >
          Voltar
        </button>
        <button
          type="button"
          className="font-medium text-primary hover:underline"
          onClick={() => {
            setUseRecovery((v) => !v);
            setCode("");
            setFieldError(undefined);
          }}
        >
          {useRecovery ? "Usar o app autenticador" : "Usar código de recuperação"}
        </button>
      </div>
    </form>
  );
}
