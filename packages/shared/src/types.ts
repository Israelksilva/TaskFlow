import type { TaskPriority, TaskStatus } from "./constants";

/** Contratos (DTOs) trafegados pela API em JSON. Datas/horas são strings ISO 8601. */

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  /** Posição (0..n-1) dentro da coluna. */
  position: number;
  /** Data de entrega no formato YYYY-MM-DD. */
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BoardStats {
  total: number;
  completed: number;
  overdue: number;
  dueToday: number;
  /** Percentual (0-100) de tarefas concluídas. */
  completionRate: number;
  byStatus: Record<TaskStatus, number>;
  byPriority: Record<TaskPriority, number>;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
}
