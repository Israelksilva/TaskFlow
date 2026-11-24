import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  moveTask,
  removeTask,
  sortTasks,
  STATUS_LABELS,
  type CreateTaskInput,
  type Task,
  type TaskStatus,
  type UpdateTaskInput,
} from "@andamo/shared";
import { getErrorMessage } from "@/lib/api-client";
import { tasksApi } from "./api";

export const TASKS_KEY = ["tasks"] as const;

export function useTasks() {
  return useQuery({
    queryKey: TASKS_KEY,
    queryFn: ({ signal }) => tasksApi.list(signal),
    select: sortTasks,
  });
}

/** Insere/substitui uma tarefa no cache sem duplicar (idempotente por id). */
function upsert(tasks: Task[] | undefined, task: Task): Task[] {
  const list = tasks ?? [];
  return list.some((t) => t.id === task.id)
    ? list.map((t) => (t.id === task.id ? task : t))
    : [...list, task];
}

/** Criação aguarda o servidor (precisa do id real) e não é otimista. */
export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ["tasks", "create"],
    mutationFn: tasksApi.create,
    onSuccess: (task) => {
      qc.setQueryData<Task[]>(TASKS_KEY, (old) => upsert(old, task));
      toast.success("Tarefa criada", { description: task.title });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: TASKS_KEY }),
  });
}

/** Edição pelo formulário: aguarda o servidor; o formulário fica aberto se falhar. */
export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ["tasks", "update"],
    mutationFn: ({ id, changes }: { id: string; changes: UpdateTaskInput }) =>
      tasksApi.update(id, changes),
    onSuccess: (task) => {
      qc.setQueryData<Task[]>(TASKS_KEY, (old) => upsert(old, task));
      toast.success("Alterações salvas");
    },
    // Mudança de status reposiciona outras tarefas: sincroniza com o banco.
    onSettled: () => qc.invalidateQueries({ queryKey: TASKS_KEY }),
  });
}

export interface MoveVariables {
  task: Task;
  status: TaskStatus;
  position: number;
  /** Estado do quadro antes do arraste (para desfazer em caso de erro). */
  rollback?: Task[];
}

/**
 * Mover (arrastar, menu ou teclado): atualização otimista.
 * Se a API falhar, o quadro volta ao estado anterior e o usuário pode tentar de novo.
 */
export function useMoveTask() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationKey: ["tasks", "move"],
    mutationFn: ({ task, status, position }: MoveVariables) =>
      tasksApi.update(task.id, { status, position }),
    onMutate: async ({ task, status, position, rollback }) => {
      // revert:false — não desfaz o estado já aplicado pelo arraste.
      await qc.cancelQueries({ queryKey: TASKS_KEY }, { revert: false });
      const previous = rollback ?? qc.getQueryData<Task[]>(TASKS_KEY);
      qc.setQueryData<Task[]>(TASKS_KEY, (old) =>
        old && old.some((t) => t.id === task.id) ? moveTask(old, task.id, status, position) : old,
      );
      return { previous };
    },
    onError: (error, variables, context) => {
      if (context?.previous) qc.setQueryData(TASKS_KEY, context.previous);
      toast.error(`Não foi possível mover “${variables.task.title}”`, {
        description: `${getErrorMessage(error)} A tarefa voltou para a posição anterior.`,
        action: {
          label: "Tentar novamente",
          onClick: () => mutation.mutate({ ...variables, rollback: undefined }),
        },
      });
    },
    onSuccess: (_task, { task, status }) => {
      if (task.status !== status) toast.success(`Movida para ${STATUS_LABELS[status]}`, { description: task.title });
    },
    // Com vários movimentos em sequência, sincroniza só quando o último terminar
    // (evita que uma resposta antiga sobrescreva a tela).
    onSettled: () => {
      if (qc.isMutating({ mutationKey: ["tasks", "move"] }) <= 1) {
        return qc.invalidateQueries({ queryKey: TASKS_KEY });
      }
    },
  });
  return mutation;
}

/** Exclusão após confirmação: some da tela na hora e volta se a API falhar. */
export function useDeleteTask() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationKey: ["tasks", "delete"],
    mutationFn: (task: Task) => tasksApi.remove(task.id),
    onMutate: async (task) => {
      await qc.cancelQueries({ queryKey: TASKS_KEY });
      const previous = qc.getQueryData<Task[]>(TASKS_KEY);
      qc.setQueryData<Task[]>(TASKS_KEY, (old) => (old ? removeTask(old, task.id) : old));
      return { previous };
    },
    onError: (error, task, context) => {
      if (context?.previous) qc.setQueryData(TASKS_KEY, context.previous);
      toast.error(`Não foi possível excluir “${task.title}”`, {
        description: `${getErrorMessage(error)} A tarefa foi mantida.`,
        action: { label: "Tentar novamente", onClick: () => mutation.mutate(task) },
      });
    },
    onSuccess: (_r, task) => toast.success("Tarefa excluída", { description: task.title }),
    onSettled: () => qc.invalidateQueries({ queryKey: TASKS_KEY }),
  });
  return mutation;
}

export function useImportTasks() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ["tasks", "import"],
    mutationFn: (tasks: CreateTaskInput[]) => tasksApi.importMany(tasks),
    onSuccess: (tasks) => toast.success(`${tasks.length} tarefa(s) importada(s) para sua conta`),
    onSettled: () => qc.invalidateQueries({ queryKey: TASKS_KEY }),
  });
}
