import { z } from "zod";
import { TASK_PRIORITIES } from "../constants";
import { taskStatusSchema, uuidSchema } from "./task";

export const AUTOMATION_TRIGGERS = [
  "task.created",
  "task.completed",
  "task.status_changed",
  "task.moved",
  "task.overdue",
  "subtasks.completed",
  "project.completed",
] as const;
export type AutomationTrigger = (typeof AUTOMATION_TRIGGERS)[number];

export const TRIGGER_LABELS: Record<AutomationTrigger, string> = {
  "task.created": "Quando uma tarefa for criada",
  "task.completed": "Quando uma tarefa for concluída",
  "task.status_changed": "Quando o status de uma tarefa mudar",
  "task.moved": "Quando uma tarefa mudar de coluna",
  "task.overdue": "Quando uma tarefa ficar atrasada",
  "subtasks.completed": "Quando todas as subtarefas forem concluídas",
  "project.completed": "Quando um projeto for concluído",
};

export const NOTIFY_TARGETS = ["assignees", "creator", "followers", "managers", "project_members", "user"] as const;
export type NotifyTarget = (typeof NOTIFY_TARGETS)[number];

export const NOTIFY_TARGET_LABELS: Record<NotifyTarget, string> = {
  assignees: "Responsáveis da tarefa",
  creator: "Quem criou a tarefa",
  followers: "Seguidores da tarefa",
  managers: "Gestores e administradores",
  project_members: "Equipe do projeto",
  user: "Uma pessoa específica",
};

export const automationActionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("notify"),
    target: z.enum(NOTIFY_TARGETS),
    userId: uuidSchema.optional(),
    message: z.string().trim().max(200).optional(),
  }),
  z.object({ type: z.literal("assign"), userId: uuidSchema }),
  z.object({ type: z.literal("set_priority"), priority: z.enum(TASK_PRIORITIES) }),
  z.object({ type: z.literal("move_to_column"), columnId: uuidSchema }),
  z.object({ type: z.literal("add_label"), labelId: uuidSchema }),
  z.object({ type: z.literal("set_due_in_days"), days: z.number().int().min(0).max(365) }),
  z.object({ type: z.literal("complete_parent") }),
]);
export type AutomationAction = z.infer<typeof automationActionSchema>;

export const ACTION_LABELS: Record<AutomationAction["type"], string> = {
  notify: "Notificar",
  assign: "Atribuir a",
  set_priority: "Definir prioridade",
  move_to_column: "Mover para a coluna",
  add_label: "Adicionar etiqueta",
  set_due_in_days: "Definir prazo para daqui a N dias",
  complete_parent: "Concluir a tarefa principal",
};

export const automationConditionsSchema = z
  .object({
    priorities: z.array(z.enum(TASK_PRIORITIES)).max(4).optional(),
    labelId: uuidSchema.optional(),
    assigneeId: uuidSchema.optional(),
    /** task.status_changed: novo status. */
    toStatus: taskStatusSchema.optional(),
    /** task.moved: coluna de destino. */
    toColumnId: uuidSchema.optional(),
  })
  .strict();
export type AutomationConditions = z.infer<typeof automationConditionsSchema>;

const baseSchema = z.object({
  name: z.string().trim().min(2, "Dê um nome à automação").max(80),
  projectId: uuidSchema.nullable().default(null),
  trigger: z.enum(AUTOMATION_TRIGGERS, { errorMap: () => ({ message: "Gatilho inválido" }) }),
  conditions: automationConditionsSchema.default({}),
  actions: z.array(automationActionSchema).min(1, "Adicione ao menos uma ação").max(5, "No máximo 5 ações"),
  enabled: z.boolean().default(true),
});

/** Regras de coerência entre gatilho, ações e escopo. */
function refine(a: { trigger?: AutomationTrigger; actions?: AutomationAction[]; projectId?: string | null }, ctx: z.RefinementCtx) {
  for (const [i, action] of (a.actions ?? []).entries()) {
    if (action.type === "notify" && action.target === "user" && !action.userId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["actions", i, "userId"], message: "Escolha a pessoa a notificar" });
    }
    if (action.type === "complete_parent" && a.trigger && a.trigger !== "subtasks.completed" && a.trigger !== "task.completed") {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["actions", i], message: "“Concluir a tarefa principal” só vale para conclusão de subtarefas" });
    }
    if (action.type === "move_to_column" && a.projectId === null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["actions", i], message: "Para mover de coluna, escolha um projeto" });
    }
    if (a.trigger === "project.completed" && action.type !== "notify") {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["actions", i], message: "Projetos concluídos aceitam apenas notificações" });
    }
  }
}

export const createAutomationSchema = baseSchema.superRefine(refine);
export const updateAutomationSchema = baseSchema.partial().strict().superRefine(refine);

export type CreateAutomationInput = z.input<typeof createAutomationSchema>;
export type UpdateAutomationInput = z.input<typeof updateAutomationSchema>;
