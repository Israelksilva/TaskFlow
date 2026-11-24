import {
  LIMITS,
  TASK_PRIORITIES,
  TASK_STATUSES,
  dueDateSchema,
  type CreateTaskInput,
  type TaskPriority,
  type TaskStatus,
} from "@andamo/shared";

/**
 * A versão anterior (TaskFlow) salvava as tarefas apenas no navegador.
 * Estes dados NUNCA são apagados: após importar, apenas marcamos como importados.
 */
export const LEGACY_KEY = "taskflow:tasks:v1";
const IMPORTED_MARK = "taskflow:tasks:v1:imported-at";
const DISMISSED_MARK = "taskflow:tasks:v1:dismissed";

interface LegacyTask {
  title?: unknown;
  description?: unknown;
  priority?: unknown;
  dueDate?: unknown;
  columnId?: unknown;
}

const isPriority = (v: unknown): v is TaskPriority => TASK_PRIORITIES.includes(v as TaskPriority);
const isStatus = (v: unknown): v is TaskStatus => TASK_STATUSES.includes(v as TaskStatus);

/** Converte o formato antigo ({ columnId, ... }) para o contrato da API. Função pura. */
export function convertLegacyTasks(raw: unknown): CreateTaskInput[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item: LegacyTask) => {
    const title = typeof item?.title === "string" ? item.title.trim().slice(0, LIMITS.taskTitle) : "";
    if (!title) return [];
    const description =
      typeof item.description === "string" && item.description.trim()
        ? item.description.trim().slice(0, LIMITS.taskDescription)
        : null;
    const dueDate =
      typeof item.dueDate === "string" && dueDateSchema.safeParse(item.dueDate).success
        ? item.dueDate
        : null;
    return [
      {
        title,
        description,
        priority: isPriority(item.priority) ? item.priority : "media",
        status: isStatus(item.columnId) ? item.columnId : "todo",
        dueDate,
      },
    ];
  });
}

function read(key: string, storage: Storage = localStorage) {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string, storage: Storage = localStorage) {
  try {
    storage.setItem(key, value);
  } catch {
    /* indisponível */
  }
}

/** Tarefas antigas ainda não importadas nem dispensadas. */
export function getPendingLegacyTasks(): CreateTaskInput[] {
  if (read(IMPORTED_MARK) || read(DISMISSED_MARK, sessionStorage)) return [];
  try {
    return convertLegacyTasks(JSON.parse(read(LEGACY_KEY) ?? "null"));
  } catch {
    return [];
  }
}

export const markLegacyImported = () => write(IMPORTED_MARK, new Date().toISOString());
/** "Agora não": oculta o aviso só nesta sessão do navegador. */
export const dismissLegacyImport = () => write(DISMISSED_MARK, new Date().toISOString(), sessionStorage);
