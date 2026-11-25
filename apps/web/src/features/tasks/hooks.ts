import { createContext, useContext } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  moveToColumn,
  removeTask,
  sortTasks,
  type BoardColumn,
  type CreateTaskInput,
  type Task,
  type UpdateTaskInput,
} from "@andamo/shared";
import { getErrorMessage } from "@/lib/api-client";
import { tasksApi } from "./api";

/** Quadro atual: os componentes do Kanban leem daqui o workspace e o projeto. */
export interface BoardScope {
  workspaceId: string;
  projectId: string;
}
export const BoardScopeContext = createContext<BoardScope | null>(null);

export function useBoardScope(): BoardScope {
  const scope = useContext(BoardScopeContext);
  if (!scope) throw new Error("useBoardScope fora de um quadro");
  return scope;
}

export const taskKeys = {
  all: ["tasks"] as const,
  board: (s: BoardScope) => ["tasks", s.workspaceId, "board", s.projectId] as const,
  list: (ws: string, query: object) => ["tasks", ws, "list", query] as const,
  detail: (ws: string, id: string) => ["tasks", ws, "detail", id] as const,
  comments: (ws: string, id: string) => ["tasks", ws, "comments", id] as const,
};

export function useTasks() {
  const scope = useBoardScope();
  return useQuery({
    queryKey: taskKeys.board(scope),
    queryFn: ({ signal }) => tasksApi.list(scope.workspaceId, { projectId: scope.projectId }, signal),
    select: sortTasks,
  });
}

/** Insere/substitui uma tarefa no cache sem duplicar (idempotente por id). */
function upsert(tasks: Task[] | undefined, task: Task): Task[] {
  const list = tasks ?? [];
  return list.some((t) => t.id === task.id) ? list.map((t) => (t.id === task.id ? task : t)) : [...list, task];
}

/** Criação aguarda o servidor (precisa do id real) e não é otimista. */
export function useCreateTask() {
  const qc = useQueryClient();
  const scope = useBoardScope();
  return useMutation({
    mutationKey: ["tasks", "create"],
    mutationFn: (input: CreateTaskInput) => tasksApi.create(scope.workspaceId, { ...input, projectId: input.projectId ?? scope.projectId }),
    onSuccess: (task) => {
      if (!task.parentId) qc.setQueryData<Task[]>(taskKeys.board(scope), (old) => upsert(old, task));
      toast.success("Tarefa criada", { description: task.title });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["tasks", scope.workspaceId] }),
  });
}

/** Edição pelo formulário: aguarda o servidor; o formulário fica aberto se falhar. */
export function useUpdateTask() {
  const qc = useQueryClient();
  const scope = useBoardScope();
  return useMutation({
    mutationKey: ["tasks", "update"],
    mutationFn: ({ id, changes }: { id: string; changes: UpdateTaskInput }) => tasksApi.update(scope.workspaceId, id, changes),
    onSuccess: (task) => {
      qc.setQueryData<Task[]>(taskKeys.board(scope), (old) => upsert(old, task));
      toast.success("Alterações salvas");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["tasks", scope.workspaceId] }),
  });
}

export interface MoveVariables {
  task: Task;
  columnId: string;
  position: number;
  /** Colunas do quadro (para calcular a posição otimista). */
  columns: BoardColumn[];
  /** Estado do quadro antes do arraste (para desfazer em caso de erro). */
  rollback?: Task[];
}

/**
 * Mover (arrastar, menu ou teclado): atualização otimista.
 * Se a API falhar, o quadro volta ao estado anterior e o usuário pode tentar de novo.
 */
export function useMoveTask() {
  const qc = useQueryClient();
  const scope = useBoardScope();
  const key = taskKeys.board(scope);
  const mutation = useMutation({
    mutationKey: ["tasks", "move"],
    mutationFn: ({ task, columnId, position }: MoveVariables) => tasksApi.update(scope.workspaceId, task.id, { columnId, position }),
    onMutate: async ({ task, columnId, position, columns, rollback }) => {
      // revert:false — não desfaz o estado já aplicado pelo arraste.
      await qc.cancelQueries({ queryKey: key }, { revert: false });
      const previous = rollback ?? qc.getQueryData<Task[]>(key);
      qc.setQueryData<Task[]>(key, (old) => (old && old.some((t) => t.id === task.id) ? moveToColumn(old, task.id, columnId, position, columns) : old));
      return { previous };
    },
    onError: (error, variables, context) => {
      if (context?.previous) qc.setQueryData(key, context.previous);
      toast.error(`Não foi possível mover “${variables.task.title}”`, {
        description: `${getErrorMessage(error)} A tarefa voltou para a posição anterior.`,
        action: { label: "Tentar novamente", onClick: () => mutation.mutate({ ...variables, rollback: undefined }) },
      });
    },
    onSuccess: (_task, { task, columnId, columns }) => {
      const column = columns.find((c) => c.id === columnId);
      if (column && task.columnId !== columnId) toast.success(`Movida para ${column.name}`, { description: task.title });
    },
    // Com vários movimentos em sequência, sincroniza só quando o último terminar.
    onSettled: () => {
      if (qc.isMutating({ mutationKey: ["tasks", "move"] }) <= 1) return qc.invalidateQueries({ queryKey: key });
    },
  });
  return mutation;
}

/** Exclusão (vai para a lixeira): some da tela na hora, com opção de desfazer. */
export function useDeleteTask() {
  const qc = useQueryClient();
  const scope = useBoardScope();
  const key = taskKeys.board(scope);
  const mutation = useMutation({
    mutationKey: ["tasks", "delete"],
    mutationFn: (task: Task) => tasksApi.remove(scope.workspaceId, task.id),
    onMutate: async (task) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<Task[]>(key);
      qc.setQueryData<Task[]>(key, (old) => (old ? removeTask(old, task.id) : old));
      return { previous };
    },
    onError: (error, task, context) => {
      if (context?.previous) qc.setQueryData(key, context.previous);
      toast.error(`Não foi possível excluir “${task.title}”`, {
        description: `${getErrorMessage(error)} A tarefa foi mantida.`,
        action: { label: "Tentar novamente", onClick: () => mutation.mutate(task) },
      });
    },
    onSuccess: (_r, task) =>
      toast.success("Tarefa movida para a lixeira", {
        description: task.title,
        action: {
          label: "Desfazer",
          onClick: () =>
            void tasksApi
              .restore(scope.workspaceId, task.id)
              .then(() => qc.invalidateQueries({ queryKey: ["tasks", scope.workspaceId] }))
              .catch((e) => toast.error(getErrorMessage(e))),
        },
      }),
    onSettled: () => qc.invalidateQueries({ queryKey: ["tasks", scope.workspaceId] }),
  });
  return mutation;
}

export function useImportTasks() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ["tasks", "import"],
    mutationFn: (tasks: CreateTaskInput[]) => tasksApi.importLegacy(tasks),
    onSuccess: (tasks) => toast.success(`${tasks.length} tarefa(s) importada(s) para sua conta`),
    onSettled: () => qc.invalidateQueries({ queryKey: taskKeys.all }),
  });
}
