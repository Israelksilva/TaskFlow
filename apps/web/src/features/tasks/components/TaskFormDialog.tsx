import { useEffect, useRef } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import {
  LIMITS,
  PRIORITY_LABELS,
  STATUS_LABELS,
  TASK_PRIORITIES,
  TASK_STATUSES,
  dueDateSchema,
  taskPrioritySchema,
  taskStatusSchema,
  type Task,
  type TaskStatus,
  type UpdateTaskInput,
} from "@andamo/shared";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { InlineError } from "@/components/feedback/InlineError";
import { ApiError, getErrorMessage } from "@/lib/api-client";
import { restoreFocus } from "@/lib/focus";
import { cn } from "@/lib/utils";
import { useCreateTask, useUpdateTask } from "../hooks";

const formSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Informe o título da tarefa")
    .max(LIMITS.taskTitle, `Use no máximo ${LIMITS.taskTitle} caracteres`),
  description: z
    .string()
    .max(LIMITS.taskDescription, `Use no máximo ${LIMITS.taskDescription} caracteres`),
  priority: taskPrioritySchema,
  status: taskStatusSchema,
  dueDate: z.union([dueDateSchema, z.literal("")]),
});

type FormValues = z.infer<typeof formSchema>;
const FIELDS = ["title", "description", "priority", "status", "dueDate"] as const;

interface TaskFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Presente = edição; ausente = criação. */
  task?: Task | null;
  defaultStatus?: TaskStatus;
  /** Coluna do quadro onde a tarefa deve entrar (criação pelo "+" da coluna). */
  defaultColumnId?: string;
  /** Elemento que abriu o modal: recebe o foco de volta ao fechar. */
  returnFocus?: HTMLElement | null;
}

function toFormValues(task: Task | null | undefined, status: TaskStatus): FormValues {
  return {
    title: task?.title ?? "",
    description: task?.description ?? "",
    priority: task?.priority ?? "media",
    status: task?.status ?? status,
    dueDate: task?.dueDate ?? "",
  };
}

/** Somente os campos que realmente mudaram (PATCH parcial). */
function diff(task: Task, values: FormValues): UpdateTaskInput {
  const changes: UpdateTaskInput = {};
  const description = values.description.trim() || null;
  const dueDate = values.dueDate || null;
  if (values.title !== task.title) changes.title = values.title;
  if (description !== task.description) changes.description = description;
  if (values.priority !== task.priority) changes.priority = values.priority;
  if (values.status !== task.status) changes.status = values.status;
  if (dueDate !== task.dueDate) changes.dueDate = dueDate;
  return changes;
}

export function TaskFormDialog({
  open,
  onOpenChange,
  task,
  defaultStatus = "todo",
  defaultColumnId,
  returnFocus,
}: TaskFormDialogProps) {
  const isEdit = Boolean(task);
  const create = useCreateTask();
  const update = useUpdateTask();
  const mutation = isEdit ? update : create;
  const submitting = useRef(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: toFormValues(task, defaultStatus),
  });
  const { errors } = form.formState;

  // Cada abertura começa do estado da tarefa (ou vazio) e sem erro anterior.
  useEffect(() => {
    if (!open) return;
    form.reset(toFormValues(task, defaultStatus));
    create.reset();
    update.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, task?.id, defaultStatus]);

  const onSubmit = async (values: FormValues) => {
    // Impede envio duplicado por clique repetido / Enter repetido.
    if (submitting.current) return;
    submitting.current = true;
    try {
      if (task) {
        const changes = diff(task, values);
        if (Object.keys(changes).length === 0) {
          toast.info("Nenhuma alteração para salvar");
        } else {
          await update.mutateAsync({ id: task.id, changes });
        }
      } else {
        await create.mutateAsync({
          ...values,
          // Criada pelo "+" de uma coluna: entra nela, salvo se o status escolhido for de outra categoria.
          columnId: defaultColumnId && values.status === defaultStatus ? defaultColumnId : undefined,
          description: values.description.trim() || null,
          dueDate: values.dueDate || null,
        });
      }
      onOpenChange(false);
    } catch (error) {
      // O texto digitado é mantido; erros por campo vão para junto do campo.
      if (error instanceof ApiError && error.details) {
        for (const field of FIELDS) {
          const message = error.details[field]?.[0];
          if (message) form.setError(field, { message });
        }
      }
    } finally {
      submitting.current = false;
    }
  };

  const submit = form.handleSubmit(onSubmit);
  const pending = mutation.isPending;
  const fieldError = (name: keyof FormValues) =>
    errors[name]?.message ? (
      <p id={`task-${name}-error`} className="text-xs font-medium text-destructive">
        {errors[name]?.message}
      </p>
    ) : null;
  const invalid = (name: keyof FormValues) => ({
    "aria-invalid": Boolean(errors[name]),
    "aria-describedby": errors[name] ? `task-${name}-error` : undefined,
  });

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          restoreFocus(returnFocus);
        }}
      >
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar tarefa" : "Nova tarefa"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Altere os campos desejados e salve." : "Preencha os detalhes da tarefa."} Campos com * são
            obrigatórios.
          </DialogDescription>
        </DialogHeader>

        <form
          noValidate
          onSubmit={submit}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              void submit();
            }
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="task-title">Título *</Label>
            <Input
              id="task-title"
              autoFocus
              autoComplete="off"
              placeholder="Ex.: Revisar proposta do cliente"
              maxLength={LIMITS.taskTitle + 20}
              className={cn(errors.title && "border-destructive")}
              {...invalid("title")}
              {...form.register("title")}
            />
            {fieldError("title")}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="task-description">Descrição</Label>
            <Textarea
              id="task-description"
              rows={4}
              placeholder="Detalhes, links ou próximos passos (opcional)"
              className={cn("resize-y", errors.description && "border-destructive")}
              {...invalid("description")}
              {...form.register("description")}
            />
            {fieldError("description")}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="task-status">Status</Label>
              <Controller
                control={form.control}
                name="status"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="task-status" onBlur={field.onBlur}>
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
                )}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="task-priority">Prioridade</Label>
              <Controller
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="task-priority" onBlur={field.onBlur}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[...TASK_PRIORITIES].reverse().map((p) => (
                        <SelectItem key={p} value={p}>
                          {PRIORITY_LABELS[p]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="task-dueDate">Prazo</Label>
              <Input
                id="task-dueDate"
                type="date"
                className={cn(errors.dueDate && "border-destructive")}
                {...invalid("dueDate")}
                {...form.register("dueDate")}
              />
              {fieldError("dueDate")}
            </div>
          </div>

          {mutation.isError && (
            <InlineError
              action={
                <Button type="submit" size="sm" variant="outline" disabled={pending} className="shrink-0">
                  Tentar novamente
                </Button>
              }
            >
              Não foi possível salvar. {getErrorMessage(mutation.error)} O que você digitou foi mantido.
            </InlineError>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending} aria-live="polite">
              {pending && <Loader2 className="animate-spin" aria-hidden />}
              {pending ? "Salvando…" : isEdit ? "Salvar alterações" : "Criar tarefa"}
            </Button>
          </DialogFooter>
          <p className="hidden text-right text-xs text-muted-foreground sm:block">
            Dica: <kbd>Ctrl</kbd> + <kbd>Enter</kbd> salva
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}
