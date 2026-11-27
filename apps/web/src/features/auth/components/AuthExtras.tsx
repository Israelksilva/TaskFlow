import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InlineError } from "@/components/feedback/InlineError";
import { getErrorMessage } from "@/lib/api-client";
import { authApi } from "../api";

/** "Manter conectado": sessão de 30 dias em vez de 24 h. */
export function RememberCheckbox({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-input accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      Manter conectado por 30 dias
    </label>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.8Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24Z"
      />
      <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1Z" />
      <path
        fill="#EA4335"
        d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9Z"
      />
    </svg>
  );
}

/** Botão "Continuar com Google": pede a URL à API e sai para o Google. */
export function GoogleButton({ remember }: { remember: boolean }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function start() {
    setPending(true);
    setError(null);
    try {
      const { url } = await authApi.googleStart(remember);
      window.location.assign(url);
    } catch (err) {
      setError(err);
      setPending(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="w-full"
        onClick={start}
        disabled={pending}
      >
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : <GoogleIcon />}
        Continuar com Google
      </Button>
      {Boolean(error) && <InlineError>{getErrorMessage(error)}</InlineError>}
    </div>
  );
}

export function Divider({ children }: { children: string }) {
  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      <span className="h-px flex-1 bg-border" />
      {children}
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
