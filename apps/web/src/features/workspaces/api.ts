import type {
  Activity,
  BoardColumn,
  CreateColumnInput,
  UpdateColumnInput,
  CreateProjectInput,
  DashboardData,
  DashboardQuery,
  Invitation,
  InvitationPreview,
  Label,
  LabelInput,
  Member,
  Page,
  Project,
  ReportData,
  ReportQuery,
  Role,
  SearchResults,
  Team,
  TeamInput,
  UpdateMemberInput,
  UpdateProjectInput,
  UpdateWorkspaceInput,
  Workspace,
} from "@andamo/shared";
import { apiRequest } from "@/lib/api-client";

const ws = (id: string) => `/v1/workspaces/${id}`;

export const workspacesApi = {
  list: () => apiRequest<{ workspaces: Workspace[] }>("/v1/workspaces").then((r) => r.workspaces),
  create: (name: string) => apiRequest<{ workspace: Workspace }>("/v1/workspaces", { method: "POST", body: { name } }).then((r) => r.workspace),
  update: (id: string, input: UpdateWorkspaceInput) =>
    apiRequest<{ workspace: Workspace }>(ws(id), { method: "PATCH", body: input }).then((r) => r.workspace),
  archive: (id: string, archived: boolean) =>
    apiRequest<{ workspace: Workspace }>(`${ws(id)}/arquivar`, { method: "POST", body: { archived } }).then((r) => r.workspace),
  transfer: (id: string, userId: string) =>
    apiRequest<{ workspace: Workspace }>(`${ws(id)}/transferir`, { method: "POST", body: { userId } }).then((r) => r.workspace),

  dashboard: (id: string, q: DashboardQuery) => apiRequest<DashboardData>(`${ws(id)}/dashboard`, { query: { ...q } }),
  report: (id: string, q: ReportQuery) => apiRequest<ReportData>(`${ws(id)}/relatorios`, { query: { ...q } }),
  search: (id: string, q: string, signal?: AbortSignal) => apiRequest<SearchResults>(`${ws(id)}/busca`, { query: { q }, signal }),
  activity: (id: string, cursor?: string, projectId?: string) =>
    apiRequest<Page<Activity>>(`${ws(id)}/atividades`, { query: { cursor, projectId } }),

  members: (id: string) => apiRequest<{ members: Member[] }>(`${ws(id)}/membros`).then((r) => r.members),
  updateMember: (id: string, userId: string, input: UpdateMemberInput) =>
    apiRequest<{ member: Member }>(`${ws(id)}/membros/${userId}`, { method: "PATCH", body: input }).then((r) => r.member),
  removeMember: (id: string, userId: string) => apiRequest<void>(`${ws(id)}/membros/${userId}`, { method: "DELETE" }),

  invitations: (id: string) => apiRequest<{ invitations: Invitation[] }>(`${ws(id)}/convites`).then((r) => r.invitations),
  invite: (id: string, email: string, role: Role) => apiRequest<{ id: string }>(`${ws(id)}/convites`, { method: "POST", body: { email, role } }),
  revokeInvitation: (id: string, invitationId: string) => apiRequest<void>(`${ws(id)}/convites/${invitationId}`, { method: "DELETE" }),
  previewInvitation: (token: string) =>
    apiRequest<{ invitation: InvitationPreview }>(`/v1/workspaces/convites/${encodeURIComponent(token)}`).then((r) => r.invitation),
  acceptInvitation: (token: string) =>
    apiRequest<{ workspace: Workspace }>("/v1/workspaces/convites/aceitar", { method: "POST", body: { token } }).then((r) => r.workspace),

  teams: (id: string) => apiRequest<{ teams: Team[] }>(`${ws(id)}/equipes`).then((r) => r.teams),
  saveTeam: (id: string, teamId: string | null, input: TeamInput) =>
    apiRequest<{ team: Team }>(teamId ? `${ws(id)}/equipes/${teamId}` : `${ws(id)}/equipes`, {
      method: teamId ? "PUT" : "POST",
      body: input,
    }).then((r) => r.team),
  removeTeam: (id: string, teamId: string) => apiRequest<void>(`${ws(id)}/equipes/${teamId}`, { method: "DELETE" }),

  labels: (id: string) => apiRequest<{ labels: Label[] }>(`${ws(id)}/etiquetas`).then((r) => r.labels),
  createLabel: (id: string, input: LabelInput) =>
    apiRequest<{ label: Label }>(`${ws(id)}/etiquetas`, { method: "POST", body: input }).then((r) => r.label),
  removeLabel: (id: string, labelId: string) => apiRequest<void>(`${ws(id)}/etiquetas/${labelId}`, { method: "DELETE" }),

  projects: (id: string, view: "active" | "archived" | "templates" = "active") =>
    apiRequest<{ projects: Project[] }>(`${ws(id)}/projetos`, { query: { view } }).then((r) => r.projects),
  project: (id: string, projectId: string) =>
    apiRequest<{ project: Project }>(`${ws(id)}/projetos/${projectId}`).then((r) => r.project),
  createProject: (id: string, input: CreateProjectInput) =>
    apiRequest<{ project: Project }>(`${ws(id)}/projetos`, { method: "POST", body: input }).then((r) => r.project),
  updateProject: (id: string, projectId: string, input: UpdateProjectInput) =>
    apiRequest<{ project: Project }>(`${ws(id)}/projetos/${projectId}`, { method: "PATCH", body: input }).then((r) => r.project),
  duplicateProject: (id: string, projectId: string) =>
    apiRequest<{ project: Project }>(`${ws(id)}/projetos/${projectId}/duplicar`, { method: "POST" }).then((r) => r.project),
  archiveProject: (id: string, projectId: string, archived: boolean) =>
    apiRequest<{ project: Project }>(`${ws(id)}/projetos/${projectId}/arquivar`, { method: "POST", body: { archived } }).then((r) => r.project),
  deleteProject: (id: string, projectId: string) => apiRequest<void>(`${ws(id)}/projetos/${projectId}`, { method: "DELETE" }),

  columns: (id: string, projectId: string) =>
    apiRequest<{ columns: BoardColumn[] }>(`${ws(id)}/projetos/${projectId}/colunas`).then((r) => r.columns),
  createColumn: (id: string, projectId: string, input: CreateColumnInput) =>
    apiRequest<{ column: BoardColumn }>(`${ws(id)}/projetos/${projectId}/colunas`, { method: "POST", body: input }).then((r) => r.column),
  updateColumn: (id: string, projectId: string, columnId: string, input: UpdateColumnInput) =>
    apiRequest<{ column: BoardColumn }>(`${ws(id)}/projetos/${projectId}/colunas/${columnId}`, { method: "PATCH", body: input }).then((r) => r.column),
  reorderColumns: (id: string, projectId: string, ids: string[]) =>
    apiRequest<{ columns: BoardColumn[] }>(`${ws(id)}/projetos/${projectId}/colunas/ordem`, { method: "PUT", body: { ids } }).then((r) => r.columns),
  deleteColumn: (id: string, projectId: string, columnId: string, moveToColumnId?: string) =>
    apiRequest<void>(`${ws(id)}/projetos/${projectId}/colunas/${columnId}`, { method: "DELETE", body: { moveToColumnId } }),
};
