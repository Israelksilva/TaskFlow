import { z } from "zod";

export const NOTIFICATION_CATEGORIES = ["tasks", "comments", "mentions", "reminders", "workspace", "system"] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export const NOTIFICATION_CATEGORY_LABELS: Record<NotificationCategory, string> = {
  tasks: "Tarefas",
  comments: "Comentários",
  mentions: "Menções",
  reminders: "Lembretes e prazos",
  workspace: "Workspace e equipe",
  system: "Avisos do sistema",
};

const time = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora inválida (HH:MM)")
  .nullable();

export const notificationPreferencesSchema = z
  .object({
    inApp: z.boolean(),
    push: z.boolean(),
    email: z.boolean(),
    sound: z.boolean(),
    mutedCategories: z.array(z.enum(NOTIFICATION_CATEGORIES)).max(10),
    mutedProjects: z.array(z.string().uuid()).max(200),
    quietStart: time,
    quietEnd: time,
    dndUntil: z.string().datetime({ offset: true }).nullable(),
    emailDigest: z.enum(["instant", "daily", "weekly", "off"]),
    reminderOffsets: z.array(z.number().int().min(-10080).max(43200)).max(8),
  })
  .partial()
  .strict();

export const notificationQuerySchema = z.object({
  filter: z.enum(["all", "unread"]).default("all"),
  category: z.enum(NOTIFICATION_CATEGORIES).optional(),
  cursor: z.string().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url().max(2000).refine((u) => u.startsWith("https://"), "Endpoint inválido"),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(8).max(100) }),
});

export type NotificationPreferencesInput = z.infer<typeof notificationPreferencesSchema>;
export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>;
