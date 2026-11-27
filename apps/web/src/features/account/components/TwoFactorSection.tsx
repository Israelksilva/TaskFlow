import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { mfaCodeSchema, totpCodeSchema, type User } from "@andamo/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InlineError } from "@/components/feedback/InlineError";
import { accountApi } from "@/features/auth/api";
import { useAuth } from "@/features/auth/use-auth";
import { getErrorMessage } from "@/lib/api-client";
import { CodeInput } from "./CodeInput";
import { RecoveryCodes } from "./RecoveryCodes";
import { Section } from "./Section";

const STATUS_KEY = ["account", "2fa"] as const;

/** QR code gerado no navegador (o segredo não sai para serviços de terceiros). */
function QrCode({ value }: { value: string }) {
  const [src, setSrc] = useState<string>();
  useEffect(() => {
    let alive = true;
    void import("qrcode").then(({ toDataURL }) =>
      toDataURL(value, { margin: 1, width: 192, errorCorrectionLevel: "M" }).then(
        (url) => alive && setSrc(url),
      ),
    );
    return () => {
      alive = false;
    };
  }, [value]);
  return (
    <div className="flex h-48 w-48 items-center justify-center rounded-lg border bg-white p-2">
      {src ? (
        <img src={src} alt="QR code para o app autenticador" width={176} height={176} />
      ) : (
        <Loader2 className="animate-spin text-muted-foreground" aria-hidden />
      )}
    </div>
  );
}

function EnableDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { setUser } = useAuth();
  const queryClient = useQueryClient();
  const [code, setCode] = useState("");
  const [fieldError, setFieldError] = useState<string>();
  const setup = useMutation({ mutationFn: accountApi.twoFactorSetup });
  const enable = useMutation({
    mutationFn: accountApi.twoFactorEnable,
    onSuccess: ({ user }) => {
      setUser(user);
      void queryClient.invalidateQueries({ queryKey: STATUS_KEY });
    },
  });

  useEffect(() => {
    if (open) {
      setCode("");
      setFieldError(undefined);
      enable.reset();
      setup.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reinicia só ao abrir
  }, [open]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = totpCodeSchema.safeParse(code);
    if (!parsed.success) return setFieldError(parsed.error.issues[0]?.message);
    setFieldError(undefined);
    if (!enable.isPending) enable.mutate(parsed.data);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {enable.isSuccess
              ? "Verificação em duas etapas ativa"
              : "Ativar verificação em duas etapas"}
          </DialogTitle>
          <DialogDescription>
            {enable.isSuccess
              ? "A partir de agora, o login pede um código do app além da senha."
              : "Use um app autenticador, como Google Authenticator, Microsoft Authenticator ou 1Password."}
          </DialogDescription>
        </DialogHeader>

        {enable.isSuccess ? (
          <>
            <RecoveryCodes codes={enable.data.recoveryCodes} />
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>Guardei os códigos</Button>
            </DialogFooter>
          </>
        ) : setup.isError ? (
          <InlineError>{getErrorMessage(setup.error)}</InlineError>
        ) : !setup.data ? (
          <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Gerando chave…
          </p>
        ) : (
          <form noValidate onSubmit={submit} className="space-y-4">
            <ol className="list-decimal space-y-3 pl-5 text-sm">
              <li>
                Escaneie o QR code com o app.
                <div className="mt-2">
                  <QrCode value={setup.data.otpauthUrl} />
                </div>
              </li>
              <li>
                Sem câmera? Digite a chave:{" "}
                <code className="break-all rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                  {setup.data.secret.match(/.{1,4}/g)?.join(" ")}
                </code>
              </li>
              <li>Digite o código de 6 dígitos que aparece no app.</li>
            </ol>
            <CodeInput value={code} onChange={setCode} error={fieldError} />
            {enable.isError && <InlineError>{getErrorMessage(enable.error)}</InlineError>}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={enable.isPending}>
                {enable.isPending && <Loader2 className="animate-spin" aria-hidden />}
                Ativar
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

type ConfirmMode = "disable" | "codes" | null;

function ConfirmDialog({ mode, onClose }: { mode: ConfirmMode; onClose: () => void }) {
  const { setUser } = useAuth();
  const queryClient = useQueryClient();
  const [code, setCode] = useState("");
  const [fieldError, setFieldError] = useState<string>();
  const disable = useMutation({
    mutationFn: accountApi.twoFactorDisable,
    onSuccess: (user) => {
      setUser(user);
      toast.success("Verificação em duas etapas desativada.");
      onClose();
    },
  });
  const regenerate = useMutation({
    mutationFn: accountApi.regenerateRecoveryCodes,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: STATUS_KEY }),
  });
  const action = mode === "disable" ? disable : regenerate;

  useEffect(() => {
    if (mode) {
      setCode("");
      setFieldError(undefined);
      disable.reset();
      regenerate.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reinicia só ao abrir
  }, [mode]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = (mode === "disable" ? mfaCodeSchema : totpCodeSchema).safeParse(code);
    if (!parsed.success) return setFieldError(parsed.error.issues[0]?.message);
    setFieldError(undefined);
    if (action.isPending) return;
    if (mode === "disable") disable.mutate(parsed.data);
    else regenerate.mutate(parsed.data);
  }

  return (
    <Dialog open={mode !== null} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "disable"
              ? "Desativar verificação em duas etapas"
              : "Novos códigos de recuperação"}
          </DialogTitle>
          <DialogDescription>
            {mode === "disable"
              ? "Sua conta ficará protegida só pela senha. Confirme com um código."
              : "Os códigos antigos deixam de valer. Confirme com o código do app."}
          </DialogDescription>
        </DialogHeader>
        {regenerate.isSuccess ? (
          <>
            <RecoveryCodes codes={regenerate.data.recoveryCodes} />
            <DialogFooter>
              <Button onClick={onClose}>Guardei os códigos</Button>
            </DialogFooter>
          </>
        ) : (
          <form noValidate onSubmit={submit} className="space-y-4">
            <CodeInput
              value={code}
              onChange={setCode}
              error={fieldError}
              allowRecovery={mode === "disable"}
              autoFocus
            />
            {action.isError && <InlineError>{getErrorMessage(action.error)}</InlineError>}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancelar
              </Button>
              <Button
                type="submit"
                variant={mode === "disable" ? "destructive" : "default"}
                disabled={action.isPending}
              >
                {action.isPending && <Loader2 className="animate-spin" aria-hidden />}
                {mode === "disable" ? "Desativar" : "Gerar códigos"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function TwoFactorSection({ user }: { user: User }) {
  const [enableOpen, setEnableOpen] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmMode>(null);
  const status = useQuery({
    queryKey: STATUS_KEY,
    queryFn: accountApi.twoFactorStatus,
    enabled: user.twoFactorEnabled,
  });
  const remaining = status.data?.recoveryCodesRemaining;

  return (
    <Section
      title="Verificação em duas etapas"
      description="Além da senha, o login pede um código do app autenticador do seu celular."
    >
      {user.twoFactorEnabled ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="secondary" className="gap-1">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Ativa
            </Badge>
            {remaining !== undefined && (
              <span
                className={
                  remaining <= 2 ? "font-medium text-destructive" : "text-muted-foreground"
                }
              >
                {remaining === 1
                  ? "1 código de recuperação restante"
                  : `${remaining} códigos de recuperação restantes`}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setConfirm("codes")}>
              Gerar novos códigos
            </Button>
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => setConfirm("disable")}
            >
              Desativar
            </Button>
          </div>
        </div>
      ) : (
        <Button onClick={() => setEnableOpen(true)}>Ativar verificação em duas etapas</Button>
      )}
      <EnableDialog open={enableOpen} onOpenChange={setEnableOpen} />
      <ConfirmDialog mode={confirm} onClose={() => setConfirm(null)} />
    </Section>
  );
}
