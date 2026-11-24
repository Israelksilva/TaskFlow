import { useRef } from "react";
import type { Task } from "@andamo/shared";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";
import { restoreFocus } from "@/lib/focus";

interface DeleteTaskDialogProps {
  task: Task | null;
  onCancel: () => void;
  onConfirm: (task: Task) => void;
  returnFocus?: HTMLElement | null;
}

export function DeleteTaskDialog({ task, onCancel, onConfirm, returnFocus }: DeleteTaskDialogProps) {
  // O pai limpa `task`/`returnFocus` ao fechar, antes de o Radix devolver o foco:
  // guardamos os últimos valores para o título e o retorno do foco continuarem válidos.
  const lastFocus = useRef<HTMLElement | null>(null);
  const lastTask = useRef<Task | null>(null);
  if (task) {
    lastTask.current = task;
    lastFocus.current = returnFocus ?? null;
  }
  const shown = task ?? lastTask.current;

  return (
    <AlertDialog open={Boolean(task)} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          restoreFocus(lastFocus.current);
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir tarefa?</AlertDialogTitle>
          <AlertDialogDescription>
            A tarefa <strong className="font-medium text-foreground">“{shown?.title}”</strong> será excluída
            permanentemente. Esta ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {/* Cancelar recebe o foco inicial: a opção segura é a padrão. */}
          <AlertDialogCancel autoFocus>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className={buttonVariants({ variant: "destructive" })}
            onClick={() => task && onConfirm(task)}
          >
            Excluir tarefa
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
