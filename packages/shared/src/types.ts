import type { ProjectStatus, Recurrence, TaskPriority, TaskStatus } from "./constants";
import type { PlanId } from "./plans";
import type { Role } from "./rbac";
import type { NotificationCategory } from "./schemas/notification";

/** Contratos (DTOs) trafegados pela API em JSON. Datas/horas são strings ISO 8601. */

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  avatarUrl: string | null;
  emailVerified: boolean;
  locale: string;
  timezone: string;
  twoFactorEnabled: boolean;
  onboarded: boolean;
  hasPassword: boolean;
  isPlatformAdmin: boolean;
}

/** Usuário resumido (avatares, menções, responsáveis). */
export interface UserSummary {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface AuthResponse {
  user: User;
  /** Access token (JWT de vida curta). */
  token: string;
  refreshToken: string;
  /** Segundos até o access token expirar. */
  expiresIn: number;
}

/** Login com 2FA ativo: o cliente deve enviar o código para /auth/login/2fa. */
export interface MfaChallenge {
  mfaRequired: true;
  mfaToken: string;
}

export type LoginResponse = AuthResponse | MfaChallenge;

export interface Session {
  id: string;
  userAgent: string | null;
  ip: string | null;
  createdAt: string;
  lastUsedAt: string;
  current: boolean;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  plan: PlanId;
  isPersonal: boolean;
  ownerId: string;
  /** Papel do usuário autenticado neste workspace. */
  role: Role;
  memberCount: number;
  archivedAt: string | null;
  createdAt: string;
}

export interface Member extends UserSummary {
  email: string;
  role: Role;
  jobTitle: string | null;
  department: string | null;
  capacityHours: number | null;
  joinedAt: string;
}

export interface Invitation {
  id: string;
  email: string;
  role: Role;
  invitedBy: string | null;
  expiresAt: string;
  createdAt: string;
}

export interface InvitationPreview {
  workspaceName: string;
  email: string;
  role: Role;
  inviterName: string | null;
  expired: boolean;
}

export interface Team {
  id: string;
  name: string;
  description: string | null;
  color: string;
  memberIds: string[];
  createdAt: string;
}

export interface Label {
  id: string;
  name: string;
  color: string;
}

export interface Project {
  id: string;
  workspaceId: string;
  teamId: string | null;
  name: string;
  description: string | null;
  goal: string | null;
  icon: string;
  color: string;
  status: ProjectStatus;
  priority: TaskPriority;
  startDate: string | null;
  dueDate: string | null;
  ownerId: string | null;
  isDefault: boolean;
  isTemplate: boolean;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  taskCount: number;
  doneCount: number;
  overdueCount: number;
  /** 0–100 (tarefas concluídas / total). */
  progress: number;
}

export interface Task {
  id: string;
  workspaceId: string;
  projectId: string;
  parentId: string | null;
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  /** Posição (0..n-1) dentro da coluna do projeto. */
  position: number;
  startDate: string | null;
  /** Data de entrega no formato YYYY-MM-DD. */
  dueDate: string | null;
  /** Hora do prazo (HH:MM), opcional. */
  dueTime: string | null;
  estimateMinutes: number | null;
  recurrence: Recurrence | null;
  assigneeIds: string[];
  labelIds: string[];
  createdBy: string | null;
  subtaskCount: number;
  subtaskDoneCount: number;
  checklistCount: number;
  checklistDoneCount: number;
  commentCount: number;
  /** 0–100, a partir de subtarefas e checklist (100 se concluída). */
  progress: number;
  completedAt: string | null;
  archivedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChecklistItem {
  id: string;
  content: string;
  done: boolean;
  position: number;
}

export interface TaskDetail extends Task {
  checklist: ChecklistItem[];
  followerIds: string[];
  dependencyIds: string[];
  subtasks: Task[];
}

export interface Reaction {
  emoji: string;
  count: number;
  mine: boolean;
}

export interface Comment {
  id: string;
  taskId: string;
  parentId: string | null;
  author: UserSummary | null;
  body: string;
  editedAt: string | null;
  createdAt: string;
  reactions: Reaction[];
}

export interface Activity {
  id: string;
  actor: UserSummary | null;
  entityType: string;
  entityId: string;
  projectId: string | null;
  action: string;
  data: Record<string, unknown>;
  createdAt: string;
}

export interface AppNotification {
  id: string;
  workspaceId: string | null;
  type: string;
  category: string;
  title: string;
  body: string | null;
  link: string | null;
  entityType: string | null;
  entityId: string | null;
  actor: UserSummary | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationPreferences {
  inApp: boolean;
  push: boolean;
  email: boolean;
  sound: boolean;
  mutedCategories: NotificationCategory[];
  mutedProjects: string[];
  quietStart: string | null;
  quietEnd: string | null;
  dndUntil: string | null;
  emailDigest: "instant" | "daily" | "weekly" | "off";
  reminderOffsets: number[];
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
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

export interface DashboardData {
  totals: {
    projects: number;
    tasks: number;
    todo: number;
    doing: number;
    done: number;
    overdue: number;
    completionRate: number;
  };
  /** Concluídas e criadas por dia no período. */
  series: Array<{ date: string; created: number; completed: number }>;
  upcoming: Task[];
  projects: Array<Pick<Project, "id" | "name" | "color" | "icon" | "progress" | "taskCount" | "doneCount" | "overdueCount">>;
  productivity: Array<{ user: UserSummary; assigned: number; completed: number; overdue: number }>;
  activity: Activity[];
}

export interface SearchResults {
  tasks: Array<Pick<Task, "id" | "title" | "projectId" | "status">>;
  projects: Array<Pick<Project, "id" | "name" | "color" | "icon">>;
  members: UserSummary[];
  teams: Array<Pick<Team, "id" | "name" | "color">>;
  comments: Array<{ id: string; taskId: string; excerpt: string }>;
}

export interface PublicConfig {
  integrations: { email: boolean; push: boolean; google: boolean };
  googleClientId: string | null;
  vapidPublicKey: string | null;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
}
