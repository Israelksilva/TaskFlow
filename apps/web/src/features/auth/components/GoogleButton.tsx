import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { authApi } from "../api";

interface GoogleIdentity {
  accounts: {
    id: {
      initialize: (o: { client_id: string; callback: (r: { credential: string }) => void; ux_mode?: string }) => void;
      renderButton: (el: HTMLElement, o: Record<string, unknown>) => void;
    };
  };
}
declare global {
  interface Window {
    google?: GoogleIdentity;
  }
}

let scriptPromise: Promise<void> | null = null;
function loadGis(): Promise<void> {
  scriptPromise ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Falha ao carregar o Google"));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

/**
 * Botão oficial "Entrar com Google" (Google Identity Services). Só aparece quando o servidor
 * informa um GOOGLE_CLIENT_ID configurado; o ID token é validado na API.
 */
export function GoogleButton({ onCredential, text = "signin_with" }: { onCredential: (credential: string) => void; text?: "signin_with" | "signup_with" }) {
  const ref = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();
  const config = useQuery({ queryKey: ["config"], queryFn: authApi.config, staleTime: Infinity, retry: false });
  const clientId = config.data?.googleClientId;
  const cb = useRef(onCredential);
  cb.current = onCredential;

  useEffect(() => {
    if (!clientId || !ref.current) return;
    let cancelled = false;
    loadGis()
      .then(() => {
        if (cancelled || !window.google || !ref.current) return;
        window.google.accounts.id.initialize({ client_id: clientId, callback: (r) => cb.current(r.credential) });
        window.google.accounts.id.renderButton(ref.current, {
          theme: resolvedTheme === "dark" ? "filled_black" : "outline",
          size: "large",
          shape: "pill",
          text,
          width: ref.current.offsetWidth || 320,
          locale: "pt-BR",
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [clientId, resolvedTheme, text]);

  if (!clientId) return null;
  return (
    <div className="space-y-4">
      <div ref={ref} className="flex min-h-10 w-full justify-center" />
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" /> ou com e-mail <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}
