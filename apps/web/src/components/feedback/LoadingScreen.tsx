import { Loader2 } from "lucide-react";

export function LoadingScreen({ label = "Carregando…" }: { label?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center" role="status" aria-live="polite">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        {label}
      </div>
    </div>
  );
}
