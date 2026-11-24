import { ClipboardList, Plus, RefreshCw, SearchX } from "lucide-react";
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
    <div className="flex flex-col items-center rounded-xl border border-dashed bg-card px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <ClipboardList className="h-6 w-6" aria-hidden />
      </div>
      <h2 className="mt-4 text-base font-semibold">Seu quadro está vazio</h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Crie sua primeira tarefa para começar a organizar o trabalho em A Fazer, Em Progresso e Concluído.
      </p>
      <Button className="mt-6" onClick={(e) => onCreate(e.currentTarget)}>
        <Plus aria-hidden /> Criar primeira tarefa
      </Button>
    </div>
  );
}

export function NoResults({ onClear }: { onClear: () => void }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed bg-card px-6 py-12 text-center" role="status">
      <SearchX className="h-8 w-8 text-muted-foreground" aria-hidden />
      <h2 className="mt-3 text-base font-semibold">Nenhuma tarefa encontrada</h2>
      <p className="mt-1 text-sm text-muted-foreground">Nenhuma tarefa corresponde à busca e aos filtros atuais.</p>
      <Button variant="outline" className="mt-4" onClick={onClear}>
        Limpar filtros
      </Button>
    </div>
  );
}
