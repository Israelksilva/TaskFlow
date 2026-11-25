import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Falhas inesperadas de renderização mostram uma tela amigável em vez de página em branco. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Erro de interface:", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    // Após um novo deploy, chunks antigos somem: recarregar resolve.
    const chunk = /Loading chunk|dynamically imported module|Failed to fetch/i.test(this.state.error.message);
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <AlertTriangle className="h-6 w-6" aria-hidden />
        </span>
        <div>
          <h1 className="font-display text-xl font-bold">{chunk ? "Uma nova versão está disponível" : "Algo deu errado nesta tela"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{chunk ? "Recarregue para usar a versão mais recente do Andamo." : "Seus dados estão salvos. Tente recarregar a página."}</p>
        </div>
        <Button onClick={() => window.location.reload()}>Recarregar</Button>
      </div>
    );
  }
}
