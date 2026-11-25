import { useEffect, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { STATUS_LABELS, TASK_STATUSES, type BoardColumn, type TaskStatus } from "@andamo/shared";
import { InlineError } from "@/components/feedback/InlineError";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { workspacesApi } from "@/features/workspaces/api";
import { useWsMutation, wsKeys } from "@/features/workspaces/hooks";
import { getErrorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { PROJECT_COLORS } from "./ProjectFormDialog";

const CATEGORY_HINT: Record<TaskStatus, string> = {
  todo: "Tarefas aqui contam como pendentes.",
  doing: "Tarefas aqui contam como em andamento.",
  done: "Tarefas aqui contam como concluídas (disparam conclusão, recorrência e dependências).",
};

/** Criar ou editar coluna: nome, categoria, limite WIP e cor. */
export function ColumnFormDialog({
  open,
  onOpenChange,
  workspaceId,
  projectId,
  column,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  projectId: string;
  column: BoardColumn | null;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<TaskStatus>("doing");
  const [wip, setWip] = useState("");
  const [color, setColor] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(column?.name ?? "");
    setCategory(column?.category ?? "doing");
    setWip(column?.wipLimit?.toString() ?? "");
    setColor(column?.color ?? null);
  }, [open, column]);

  const wipLimit = wip.trim() === "" ? null : Math.max(1, Math.min(999, Math.round(Number(wip))));
  const save = useWsMutation(
    () =>
      column
        ? workspacesApi.updateColumn(workspaceId, projectId, column.id, { name, category, wipLimit, color })
        : workspacesApi.createColumn(workspaceId, projectId, { name, category, wipLimit, color }),
    {
      invalidate: [wsKeys.columns(workspaceId, projectId), ["tasks", workspaceId]],
      success: column ? "Coluna atualizada" : "Coluna criada",
      onSuccess: () => onOpenChange(false),
    },
  );
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (name.trim() && !save.isPending) save.mutate(undefined);
  };
  const categoryChanged = column && column.category !== category;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{column ? "Editar coluna" : "Nova coluna"}</DialogTitle>
          <DialogDescription>Personalize o fluxo do quadro (ex.: Backlog, Revisão, Aguardando cliente).</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="col-name">Nome</Label>
            <Input id="col-name" autoFocus maxLength={40} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Em revisão" />
          </div>
          <div className="space-y-1.5">
            <Label>Categoria</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as TaskStatus)}>
              <SelectTrigger aria-label="Categoria">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TASK_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{CATEGORY_HINT[category]}</p>
            {categoryChanged && <p className="text-xs font-medium text-warning">As tarefas desta coluna passarão a ter o status “{STATUS_LABELS[category]}”.</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="col-wip">Limite de tarefas (WIP)</Label>
            <Input id="col-wip" type="number" min={1} max={999} value={wip} onChange={(e) => setWip(e.target.value)} placeholder="Sem limite" className="w-36" />
            <p className="text-xs text-muted-foreground">Ao passar do limite, a coluna fica destacada para a equipe priorizar o que já está em curso.</p>
          </div>
          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium">Cor</legend>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setColor(null)}
                aria-pressed={color === null}
                className={cn("h-7 rounded-lg border px-2 text-xs", color === null && "ring-2 ring-foreground ring-offset-2 ring-offset-background")}
              >
                Padrão
              </button>
              {PROJECT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={`Cor ${c}`}
                  aria-pressed={color === c}
                  className={cn("h-7 w-7 rounded-lg", color === c && "ring-2 ring-foreground ring-offset-2 ring-offset-background")}
                  style={{ background: c }}
                />
              ))}
            </div>
          </fieldset>
          {save.isError && <InlineError>{getErrorMessage(save.error)}</InlineError>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!name.trim() || save.isPending}>
              {save.isPending && <Loader2 className="animate-spin" aria-hidden />} {column ? "Salvar" : "Criar coluna"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Excluir coluna: se tiver tarefas, escolher para onde elas vão (nada é apagado). */
export function DeleteColumnDialog({
  column,
  columns,
  taskCount,
  workspaceId,
  projectId,
  onClose,
}: {
  column: BoardColumn | null;
  columns: BoardColumn[];
  taskCount: number;
  workspaceId: string;
  projectId: string;
  onClose: () => void;
}) {
  const others = columns.filter((c) => c.id !== column?.id);
  const [target, setTarget] = useState("");
  useEffect(() => {
    if (column) setTarget(others.find((c) => c.category === column.category)?.id ?? others[0]?.id ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [column?.id]);
  const remove = useWsMutation(() => workspacesApi.deleteColumn(workspaceId, projectId, column!.id, target || undefined), {
    invalidate: [wsKeys.columns(workspaceId, projectId), ["tasks", workspaceId]],
    success: "Coluna excluída",
    onSuccess: onClose,
  });

  return (
    <Dialog open={Boolean(column)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Excluir a coluna “{column?.name}”?</DialogTitle>
          <DialogDescription>
            {taskCount ? `As ${taskCount} tarefa(s) ativas desta coluna` : "As tarefas arquivadas ou na lixeira desta coluna, se houver,"} serão movidas para a coluna escolhida — nenhuma tarefa é apagada.
          </DialogDescription>
        </DialogHeader>
        {others.length > 0 && (
          <div className="space-y-1.5">
            <Label>Mover as tarefas para</Label>
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger aria-label="Coluna de destino">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {others.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} ({STATUS_LABELS[c.category]})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {others.length === 0 && <InlineError>O quadro precisa ter ao menos uma coluna.</InlineError>}
        {remove.isError && <InlineError>{getErrorMessage(remove.error)}</InlineError>}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="destructive" disabled={!others.length || !target || remove.isPending} onClick={() => remove.mutate(undefined)}>
            Excluir coluna
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
