import type {
  AdminAuditEntry,
  AdminOverview,
  AdminUser,
  AdminWorkspace,
  Announcement,
  AnnouncementInput,
  CreateTicketInput,
  PlanId,
  ServiceStatus,
  SupportMessage,
  SupportTicket,
  TicketPriority,
  TicketStatus,
  TicketType,
} from "@andamo/shared";
import { apiRequest } from "@/lib/api-client";

export interface TicketThread {
  ticket: SupportTicket;
  messages: SupportMessage[];
}

export const supportApi = {
  tickets: () => apiRequest<{ tickets: SupportTicket[] }>("/v1/suporte/chamados").then((r) => r.tickets),
  create: (input: CreateTicketInput) => apiRequest<{ ticket: SupportTicket }>("/v1/suporte/chamados", { method: "POST", body: input }).then((r) => r.ticket),
  thread: (id: string) => apiRequest<TicketThread>(`/v1/suporte/chamados/${id}`),
  reply: (id: string, message: string) => apiRequest<TicketThread>(`/v1/suporte/chamados/${id}/respostas`, { method: "POST", body: { message } }),
  close: (id: string) => apiRequest<TicketThread>(`/v1/suporte/chamados/${id}/encerrar`, { method: "POST" }),
  announcements: () => apiRequest<{ announcements: Announcement[] }>("/v1/suporte/avisos").then((r) => r.announcements),
};

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  handledAt: string | null;
  createdAt: string;
}

export const adminApi = {
  overview: () => apiRequest<AdminOverview>("/v1/admin/visao-geral"),
  status: () => apiRequest<ServiceStatus>("/v1/admin/status"),
  users: (q: { q?: string; status?: string; cursor?: string }) =>
    apiRequest<{ items: AdminUser[]; nextCursor: string | null }>("/v1/admin/usuarios", { query: q }),
  suspend: (id: string, suspended: boolean, reason: string) =>
    apiRequest<void>(`/v1/admin/usuarios/${id}/suspensao`, { method: "POST", body: { suspended, reason } }),
  workspaces: (q: { q?: string; plan?: string }) => apiRequest<{ workspaces: AdminWorkspace[] }>("/v1/admin/workspaces", { query: q }).then((r) => r.workspaces),
  setPlan: (id: string, plan: PlanId, reason: string) => apiRequest<void>(`/v1/admin/workspaces/${id}/plano`, { method: "POST", body: { plan, reason } }),
  audit: (q: { action?: string; cursor?: string }) => apiRequest<{ items: AdminAuditEntry[]; nextCursor: string | null }>("/v1/admin/auditoria", { query: q }),
  announcements: () => apiRequest<{ announcements: Announcement[] }>("/v1/admin/avisos").then((r) => r.announcements),
  createAnnouncement: (input: AnnouncementInput) => apiRequest<{ announcement: Announcement }>("/v1/admin/avisos", { method: "POST", body: input }),
  endAnnouncement: (id: string) => apiRequest<void>(`/v1/admin/avisos/${id}/encerrar`, { method: "POST" }),
  contacts: () => apiRequest<{ messages: ContactMessage[] }>("/v1/admin/contatos").then((r) => r.messages),
  setContactHandled: (id: string, handled: boolean) => apiRequest<void>(`/v1/admin/contatos/${id}/atendido`, { method: "POST", body: { handled } }),
  tickets: (q: { status?: TicketStatus | "active"; type?: TicketType }) =>
    apiRequest<{ tickets: SupportTicket[] }>("/v1/admin/suporte", { query: q }).then((r) => r.tickets),
  ticket: (id: string) => apiRequest<TicketThread>(`/v1/admin/suporte/${id}`),
  replyTicket: (id: string, message: string) => apiRequest<TicketThread>(`/v1/admin/suporte/${id}/respostas`, { method: "POST", body: { message } }),
  updateTicket: (id: string, data: { status?: TicketStatus; priority?: TicketPriority }) =>
    apiRequest<TicketThread>(`/v1/admin/suporte/${id}`, { method: "PATCH", body: data }),
};
