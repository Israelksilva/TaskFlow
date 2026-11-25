import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "loading" | "success" | "error";

const TONES: Record<Tone, { icon: typeof Loader2; className: string; role: "status" | "alert" }> = {
  loading: { icon: Loader2, className: "border-border bg-muted/50 text-muted-foreground", role: "status" },
  success: { icon: CheckCircle2, className: "border-success/30 bg-success/10 text-success", role: "status" },
  error: { icon: AlertCircle, className: "border-destructive/30 bg-destructive/10 text-destructive", role: "alert" },
};

/** Mensagem curta de carregando, sucesso ou erro, anunciada a leitores de tela. */
export function StatusMessage({ tone, children, className }: { tone: Tone; children: ReactNode; className?: string }) {
  const { icon: Icon, className: toneClass, role } = TONES[tone];
  return (
    <p role={role} className={cn("flex items-center gap-2 rounded-lg border px-3 py-2 text-sm", toneClass, className)}>
      <Icon className={cn("h-4 w-4 shrink-0", tone === "loading" && "animate-spin")} aria-hidden />
      <span>{children}</span>
    </p>
  );
}
