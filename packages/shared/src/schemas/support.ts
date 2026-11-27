import { z } from "zod";
import { PLAN_IDS } from "../plans";
import { uuidSchema } from "./task";

export const TICKET_TYPES = ["question", "bug", "suggestion", "billing", "other"] as const;
export type TicketType = (typeof TICKET_TYPES)[number];
export const TICKET_TYPE_LABELS: Record<TicketType, string> = {
  question: "Dúvida",
  bug: "Relato de erro",
  suggestion: "Sugestão",
  billing: "Planos e cobrança",
  other: "Outro assunto",
};

export const TICKET_STATUSES = ["open", "in_progress", "waiting_user", "resolved", "closed"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];
export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  open: "Aberto",
  in_progress: "Em atendimento",
  waiting_user: "Aguardando você",
  resolved: "Resolvido",
  closed: "Encerrado",
};

export const TICKET_PRIORITIES = ["low", "normal", "high"] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];
export const TICKET_PRIORITY_LABELS: Record<TicketPriority, string> = { low: "Baixa", normal: "Normal", high: "Alta" };

const message = z.string().trim().min(5, "Descreva com ao menos 5 caracteres").max(5000);

export const createTicketSchema = z.object({
  type: z.enum(TICKET_TYPES),
  subject: z.string().trim().min(3, "Informe o assunto").max(140),
  message,
  workspaceId: uuidSchema.optional(),
});

export const ticketReplySchema = z.object({ message });

export const updateTicketSchema = z
  .object({ status: z.enum(TICKET_STATUSES).optional(), priority: z.enum(TICKET_PRIORITIES).optional() })
  .strict()
  .refine((d) => d.status || d.priority, "Informe status ou prioridade");

export const ticketQuerySchema = z.object({
  status: z.enum([...TICKET_STATUSES, "active"] as const).optional(),
  type: z.enum(TICKET_TYPES).optional(),
});

// ---------------------------------------------------------------- administração
export const adminUserQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(["all", "active", "suspended"]).default("all"),
  cursor: z.string().max(100).optional(),
});

export const adminWorkspaceQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  plan: z.enum(PLAN_IDS).optional(),
});

export const adminSetPlanSchema = z.object({
  plan: z.enum(PLAN_IDS),
  reason: z.string().trim().min(3, "Informe o motivo (fica na auditoria)").max(300),
});

export const adminSuspendSchema = z.object({
  suspended: z.boolean(),
  reason: z.string().trim().min(3, "Informe o motivo (fica na auditoria)").max(300),
});

export const announcementSchema = z
  .object({
    title: z.string().trim().min(3).max(120),
    body: z.string().trim().max(1000).default(""),
    level: z.enum(["info", "warning", "critical"]).default("info"),
    startsAt: z.string().datetime({ offset: true }).optional(),
    endsAt: z.string().datetime({ offset: true }).nullable().optional(),
    /** Também envia notificação (central, push e e-mail conforme preferências) a todos os usuários ativos. */
    notify: z.boolean().default(false),
  })
  .refine((a) => !a.endsAt || !a.startsAt || a.endsAt > a.startsAt, { path: ["endsAt"], message: "O fim deve ser depois do início" });

export type CreateTicketInput = z.input<typeof createTicketSchema>;
export type AnnouncementInput = z.input<typeof announcementSchema>;
