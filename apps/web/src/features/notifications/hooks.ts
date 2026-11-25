import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/api-client";
import { notificationsApi } from "./api";

export const notificationKeys = {
  all: ["notifications"] as const,
  count: ["notifications", "count"] as const,
  list: (filter: string, category?: string) => ["notifications", "list", filter, category ?? "all"] as const,
  prefs: ["notifications", "prefs"] as const,
};

export function useUnreadCount() {
  return useQuery({ queryKey: notificationKeys.count, queryFn: notificationsApi.unreadCount, refetchInterval: 120_000 });
}

export function useNotifications(filter: "all" | "unread" = "all", category?: string) {
  return useInfiniteQuery({
    queryKey: notificationKeys.list(filter, category),
    queryFn: ({ pageParam }) => notificationsApi.list({ filter, category, cursor: pageParam, limit: 20 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

export function useNotificationActions() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: notificationKeys.all });
  const onError = (e: unknown) => toast.error(getErrorMessage(e));
  return {
    markRead: useMutation({ mutationFn: ({ id, read }: { id: string; read: boolean }) => notificationsApi.markRead(id, read), onSettled: invalidate, onError }),
    markAll: useMutation({ mutationFn: notificationsApi.markAllRead, onSettled: invalidate, onError }),
    remove: useMutation({ mutationFn: notificationsApi.remove, onSettled: invalidate, onError }),
  };
}

export function useNotificationPreferences() {
  return useQuery({ queryKey: notificationKeys.prefs, queryFn: notificationsApi.preferences });
}
