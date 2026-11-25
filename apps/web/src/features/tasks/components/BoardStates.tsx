import { ClipboardList, Plus, RefreshCw, SearchX } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { InlineError } from "@/components/feedback/InlineError";

export function BoardSkeleton() {
  return (
    <div role="status" aria-live="polite" className="grid gap-4 md:grid-cols-3">
      <span className="sr-only">Carregando tarefas…</span>
      {[3, 2, 1].map((cards, i) => (
        <div key={i} className={i > 0 ? "hidden rounded-xl border bg-muted/40 p-3 md:block" : "rounded-xl border bg-muted/40 p-3"}>
          <Skeleton className="mb-3 h-5 w-28" />
          <div className="space-y-2">
            {Array.from({ length: cards }).map((_, j) => (
              <Skeleton key={j} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function BoardError({ message, onRetry, retrying }: { message: string; onRetry: () => void; retrying: boolean }) {
  return (
    <div className="mx-auto max-w-lg py-12">
      <InlineError
        action={
          <Button size="sm" variant="outline" onClick={onRetry} disabled={retrying} className="shrink-0">
            <RefreshCw className={retrying ? "animate-spin" : undefined} aria-hidden />
            Tentar novamente
          </Button>
        }
      >
        Não foi possível carregar suas tarefas. {message}
      </InlineError>
    </div>
  );
}

/** Quadro sem nenhuma tarefa (diferente de "filtro sem resultados"). */
export function EmptyBoard({ onCreate }: { onCreate: (el: HTMLElement) => void }) {
  return (
    <EmptyState
      icon={ClipboardList}
      title="Seu quadro está vazio"
      description="Crie sua primeira tarefa para começar a organizar o trabalho em A Fazer, Em Progresso e Concluído."
      action={
        <Button variant="brand" onClick={(e) => onCreate(e.currentTarget)}>
          <Plus aria-hidden /> Criar primeira tarefa
        </Button>
      }
    />
  );
}

export function NoResults({ onClear }: { onClear: () => void }) {
  return (
    <div role="status">
      <EmptyState
        icon={SearchX}
        title="Nenhuma tarefa encontrada"
        description="Nenhuma tarefa corresponde à busca e aos filtros atuais."
        action={
          <Button variant="outline" onClick={onClear}>
            Limpar filtros
          </Button>
        }
      />
    </div>
  );
}
