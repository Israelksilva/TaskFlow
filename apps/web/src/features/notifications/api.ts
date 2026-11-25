import type { AppNotification, NotificationPreferences, NotificationPreferencesInput, Page } from "@andamo/shared";
import { apiRequest } from "@/lib/api-client";

export const notificationsApi = {
  list: (q: { filter?: "all" | "unread"; category?: string; cursor?: string; limit?: number } = {}) =>
    apiRequest<Page<AppNotification>>("/v1/notificacoes", { query: q }),
  unreadCount: () => apiRequest<{ unread: number }>("/v1/notificacoes/contagem").then((r) => r.unread),
  markRead: (id: string, read = true) => apiRequest<void>(`/v1/notificacoes/${id}/lida`, { method: "POST", body: { read } }),
  markAllRead: () => apiRequest<{ updated: number }>("/v1/notificacoes/lidas", { method: "POST" }),
  remove: (id: string) => apiRequest<void>(`/v1/notificacoes/${id}`, { method: "DELETE" }),
  preferences: () => apiRequest<{ preferences: NotificationPreferences }>("/v1/notificacoes/preferencias").then((r) => r.preferences),
  updatePreferences: (input: NotificationPreferencesInput) =>
    apiRequest<{ preferences: NotificationPreferences }>("/v1/notificacoes/preferencias", { method: "PUT", body: input }).then(
      (r) => r.preferences,
    ),
  subscribePush: (sub: PushSubscriptionJSON) => apiRequest<void>("/v1/notificacoes/push/inscricoes", { method: "POST", body: sub }),
  unsubscribePush: (endpoint: string) => apiRequest<void>("/v1/notificacoes/push/inscricoes", { method: "DELETE", body: { endpoint } }),
};
