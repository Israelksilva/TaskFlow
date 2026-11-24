import { useIsFetching, useIsMutating } from "@tanstack/react-query";
import { CheckCircle2, Loader2, RefreshCw } from "lucide-react";

/** Mostra se há alterações sendo salvas ou sincronização em andamento. */
export function SaveIndicator() {
  const saving = useIsMutating({ mutationKey: ["tasks"] });
  const fetching = useIsFetching({ queryKey: ["tasks"] });

  let content = (
    <>
      <CheckCircle2 className="h-3.5 w-3.5 text-success" aria-hidden /> Tudo salvo
    </>
  );
  if (saving > 0) {
    content = (
      <>
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Salvando…
      </>
    );
  } else if (fetching > 0) {
    content = (
      <>
        <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden /> Sincronizando…
      </>
    );
  }

  return (
    <p role="status" aria-live="polite" className="flex items-center gap-1.5 text-xs text-muted-foreground">
      {content}
    </p>
  );
}
