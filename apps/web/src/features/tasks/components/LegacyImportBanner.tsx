import { useState } from "react";
import { HardDriveDownload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getErrorMessage } from "@/lib/api-client";
import { pluralize } from "@/lib/format";
import { useImportTasks } from "../hooks";
import { dismissLegacyImport, getPendingLegacyTasks, markLegacyImported } from "../legacy-storage";

/**
 * Oferece importar as tarefas salvas pela versão antiga (somente no navegador).
 * Os dados originais continuam no localStorage mesmo após a importação.
 */
export function LegacyImportBanner() {
  const [pending, setPending] = useState(getPendingLegacyTasks);
  const importTasks = useImportTasks();

  if (pending.length === 0) return null;

  const handleImport = () => {
    if (importTasks.isPending) return;
    importTasks.mutate(pending, {
      onSuccess: () => {
        markLegacyImported();
        setPending([]);
      },
    });
  };

  return (
    <section
      aria-labelledby="legacy-import-title"
      className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center"
    >
      <HardDriveDownload className="hidden h-5 w-5 shrink-0 text-primary sm:block" aria-hidden />
      <div className="flex-1 text-sm">
        <h2 id="legacy-import-title" className="font-medium">
          Encontramos {pluralize(pending.length, "tarefa salva", "tarefas salvas")} neste navegador
        </h2>
        <p className="text-muted-foreground">
          São da versão anterior (TaskFlow). Importe para sua conta para acessá-las de qualquer lugar — a cópia
          local é mantida.
        </p>
        {importTasks.isError && (
          <p role="alert" className="mt-1 font-medium text-destructive">
            Falha ao importar: {getErrorMessage(importTasks.error)} Tente novamente.
          </p>
        )}
      </div>
      <div className="flex gap-2">
        <Button
          variant="ghost"
          size="sm"
          disabled={importTasks.isPending}
          onClick={() => {
            dismissLegacyImport();
            setPending([]);
          }}
        >
          Agora não
        </Button>
        <Button size="sm" onClick={handleImport} disabled={importTasks.isPending}>
          {importTasks.isPending && <Loader2 className="animate-spin" aria-hidden />}
          {importTasks.isPending ? "Importando…" : "Importar tarefas"}
        </Button>
      </div>
    </section>
  );
}
