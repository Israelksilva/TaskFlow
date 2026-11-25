export const TASK_STATUSES = ["todo", "doing", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ["baixa", "media", "alta", "urgente"] as const;
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
  urgente: "Urgente",
};

/** Peso usado para ordenar por prioridade (maior = mais urgente). */
export const PRIORITY_WEIGHT: Record<TaskPriority, number> = {
  baixa: 1,
  media: 2,
  alta: 3,
  urgente: 4,
};

export const PROJECT_STATUSES = ["planning", "active", "on_hold", "completed", "cancelled"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  planning: "Planejamento",
  active: "Ativo",
  on_hold: "Pausado",
  completed: "Concluído",
  cancelled: "Cancelado",
};

export const RECURRENCES = ["daily", "weekly", "monthly"] as const;
export type Recurrence = (typeof RECURRENCES)[number];

export const RECURRENCE_LABELS: Record<Recurrence, string> = {
  daily: "Diária",
  weekly: "Semanal",
  monthly: "Mensal",
};

export const LIMITS = {
  taskTitle: 120,
  taskDescription: 20000,
  boardName: 60,
  boardDescription: 280,
  projectName: 80,
  projectDescription: 2000,
  workspaceName: 80,
  userName: 80,
  comment: 5000,
  checklistItem: 300,
  passwordMin: 8,
  passwordMax: 72,
} as const;

/** Antecedências de lembrete (minutos antes do prazo; negativo = depois do vencimento). */
export const REMINDER_OFFSETS = [
  { minutes: 10080, label: "7 dias antes" },
  { minutes: 4320, label: "3 dias antes" },
  { minutes: 1440, label: "1 dia antes" },
  { minutes: 60, label: "1 hora antes" },
  { minutes: 0, label: "No vencimento" },
  { minutes: -1440, label: "1 dia após o vencimento" },
] as const;

/** Horário assumido para prazos sem hora definida (no fuso do usuário). */
export const DEFAULT_DUE_TIME = "18:00";
