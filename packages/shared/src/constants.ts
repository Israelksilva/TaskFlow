export const TASK_STATUSES = ["todo", "doing", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ["baixa", "media", "alta"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "A Fazer",
  doing: "Em Progresso",
  done: "Concluído",
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
};

/** Peso usado para ordenar por prioridade (maior = mais urgente). */
export const PRIORITY_WEIGHT: Record<TaskPriority, number> = {
  baixa: 1,
  media: 2,
  alta: 3,
};

export const LIMITS = {
  taskTitle: 120,
  taskDescription: 2000,
  boardName: 60,
  boardDescription: 280,
  userName: 80,
  passwordMin: 8,
  passwordMax: 72,
} as const;
