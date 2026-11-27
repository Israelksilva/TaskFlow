import type { TaskPriority, TaskStatus } from "./constants";

/** Contratos (DTOs) trafegados pela API em JSON. Datas/horas são strings ISO 8601. */

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  emailVerified: boolean;
  /** `false` em contas criadas só com o Google. */
  hasPassword: boolean;
  twoFactorEnabled: boolean;
  googleLinked: boolean;
  locale: string;
  timezone: string;
}

/** Sessão aberta: token de acesso curto + refresh token (trocado a cada renovação). */
export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
  /** Validade do token de acesso, em segundos. */
  expiresIn: number;
}

/** Login com 2FA ativo: falta o código do app autenticador. */
export interface MfaChallenge {
  mfaRequired: true;
  mfaToken: string;
}

export type LoginResponse = AuthResponse | MfaChallenge;

export interface SessionInfo {
  id: string;
  current: boolean;
  userAgent: string | null;
  ip: string | null;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
}

/** O que está habilitado no servidor (o front esconde o que depende de configuração). */
export interface AuthConfig {
  emailEnabled: boolean;
  googleEnabled: boolean;
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
