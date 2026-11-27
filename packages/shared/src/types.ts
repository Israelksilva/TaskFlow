import type { ProjectStatus, Recurrence, TaskPriority, TaskStatus } from "./constants";
import type { PlanId } from "./plans";
import type { Role } from "./rbac";
import type { AutomationAction, AutomationConditions, AutomationTrigger } from "./schemas/automation";
import type { NotificationCategory } from "./schemas/notification";
import type { TicketPriority, TicketStatus, TicketType } from "./schemas/support";

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
  /** Coluna do quadro (o status é a categoria dessa coluna). */
  columnId: string | null;
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
  /** Tempo apontado (soma das entradas de tempo, em segundos). */
  trackedSeconds: number;
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

export interface TimeEntry {
  id: string;
  workspaceId: string;
  taskId: string;
  taskTitle: string;
  projectId: string;
  user: UserSummary;
  startedAt: string;
  endedAt: string | null;
  /** Para o cronômetro em andamento, é calculado até agora. */
  durationSeconds: number;
  note: string | null;
  source: "timer" | "manual";
}

export interface TimeSummary {
  totalSeconds: number;
  byProject: Array<{ projectId: string; name: string; color: string; seconds: number }>;
  byUser: Array<{ user: UserSummary; seconds: number }>;
  /** Estimado × realizado por tarefa (tarefas com tempo ou estimativa no período). */
  byTask: Array<{ taskId: string; projectId: string; title: string; estimateMinutes: number | null; trackedSeconds: number }>;
  byDay: Array<{ date: string; seconds: number }>;
}

export interface Subscription {
  id: string;
  plan: "pro" | "business";
  status: "pending" | "authorized" | "paused" | "cancelled";
  amountCents: number;
  payerEmail: string;
  testMode: boolean;
  nextPaymentAt: string | null;
  /** Depois de cancelada, o plano pago vale até esta data. */
  endsAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
}

export interface BillingInfo {
  /** Mercado Pago configurado na API. */
  available: boolean;
  /** Nesta versão, sempre true: só credenciais de teste são aceitas. */
  testMode: boolean;
  subscription: Subscription | null;
}

export interface Attachment {
  id: string;
  projectId: string;
  taskId: string | null;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  uploadedBy: UserSummary | null;
  createdAt: string;
}

export interface StorageUsage {
  available: boolean;
  usedBytes: number;
  limitBytes: number;
}

export interface SupportTicket {
  id: string;
  type: TicketType;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  /** Quem abriu (para a equipe de suporte). */
  requester: (UserSummary & { email: string }) | null;
  workspaceName: string | null;
  messageCount: number;
  lastMessageAt: string;
  createdAt: string;
  closedAt: string | null;
}

export interface SupportMessage {
  id: string;
  author: UserSummary | null;
  isStaff: boolean;
  body: string;
  createdAt: string;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  level: "info" | "warning" | "critical";
  startsAt: string;
  endsAt: string | null;
  createdAt: string;
}

export interface AdminOverview {
  users: { total: number; active30d: number; new7d: number; new30d: number; suspended: number };
  workspaces: { total: number; team: number; byPlan: Record<string, number> };
  /** Workspaces em planos pagos (atribuídos; ainda não há cobrança online). */
  subscriptions: number;
  /** Receita mensal recorrente estimada a partir dos planos atribuídos (centavos). */
  mrrCents: number;
  /** Mudanças de plano pago → Free nos últimos 30 dias (auditoria). */
  cancellations30d: number;
  /** Workspaces de equipe em plano pago / workspaces de equipe (%). */
  conversionRate: number;
  signups: Array<{ date: string; count: number }>;
  support: { open: number; waiting: number };
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  lastLoginAt: string | null;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  isPlatformAdmin: boolean;
  suspendedAt: string | null;
  workspaceCount: number;
}

export interface AdminWorkspace {
  id: string;
  name: string;
  plan: PlanId;
  isPersonal: boolean;
  owner: { id: string; name: string; email: string } | null;
  memberCount: number;
  projectCount: number;
  createdAt: string;
  archivedAt: string | null;
}

export interface AdminAuditEntry {
  id: string;
  actor: { id: string; name: string } | null;
  action: string;
  target: string | null;
  workspaceId: string | null;
  ip: string | null;
  data: Record<string, unknown>;
  createdAt: string;
}

export interface ServiceStatus {
  database: { ok: boolean; latencyMs: number };
  jobs: Record<string, number>;
  failedJobs24h: Array<{ type: string; count: number; lastError: string | null }>;
  deliveries24h: Record<string, number>;
  realtimeConnections: number;
  integrations: { email: boolean; push: boolean; google: boolean; payments: boolean; storage: boolean };
  uptimeSeconds: number;
}

export interface Automation {
  id: string;
  workspaceId: string;
  projectId: string | null;
  name: string;
  enabled: boolean;
  trigger: AutomationTrigger;
  conditions: AutomationConditions;
  actions: AutomationAction[];
  createdBy: UserSummary | null;
  runCount: number;
  lastRunAt: string | null;
  lastError: string | null;
  createdAt: string;
}

export interface AutomationRun {
  id: string;
  automationId: string;
  automationName: string;
  taskId: string | null;
  taskTitle: string | null;
  status: "success" | "skipped" | "failed";
  detail: string | null;
  depth: number;
  createdAt: string;
}

/** Indicadores de um período. */
export interface ReportTotals {
  created: number;
  completed: number;
  /** Abertas com prazo vencido ao fim do período. */
  overdue: number;
  /** Concluídas no período / (concluídas + ainda abertas criadas até o fim do período), 0–100. */
  completionRate: number;
  /** Média de horas entre criação e conclusão (tarefas concluídas no período). */
  avgCompletionHours: number | null;
  /** % das concluídas com prazo que terminaram até o prazo. */
  onTimeRate: number | null;
  trackedSeconds: number;
}

export interface ReportData {
  period: { from: string; to: string };
  previous: { from: string; to: string };
  totals: ReportTotals;
  previousTotals: ReportTotals;
  granularity: "day" | "week";
  series: Array<{ bucket: string; created: number; completed: number; trackedSeconds: number }>;
  byProject: Array<{
    projectId: string;
    name: string;
    color: string;
    open: number;
    completed: number;
    overdue: number;
    avgCompletionHours: number | null;
    trackedSeconds: number;
  }>;
  byPerson: Array<{
    user: UserSummary;
    open: number;
    completed: number;
    overdue: number;
    trackedSeconds: number;
    /** Soma das estimativas das tarefas abertas (minutos) — carga de trabalho. */
    openEstimateMinutes: number;
    capacityHours: number | null;
  }>;
  byPriority: Array<{ priority: string; open: number; completed: number }>;
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
  integrations: { email: boolean; push: boolean; google: boolean; payments: boolean; storage: boolean };
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
