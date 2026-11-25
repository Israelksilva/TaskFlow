import { z } from "zod";
import { LIMITS, RECURRENCES, TASK_PRIORITIES, TASK_STATUSES } from "../constants";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const uuidSchema = z.string().uuid("Identificador inválido");

export const taskStatusSchema = z.enum(TASK_STATUSES, {
  errorMap: () => ({ message: "Status inválido" }),
});

export const taskPrioritySchema = z.enum(TASK_PRIORITIES, {
  errorMap: () => ({ message: "Prioridade inválida" }),
});

/** Data no formato YYYY-MM-DD (sem fuso horário), validada como data de calendário real. */
export const dueDateSchema = z
  .string()
  .regex(ISO_DATE, "Data deve estar no formato AAAA-MM-DD")
  .refine((value) => {
    const [y, m, d] = value.split("-").map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
  }, "Data inválida");

const titleSchema = z
  .string({ required_error: "Informe o título" })
  .trim()
  .min(1, "Informe o título")
  .max(LIMITS.taskTitle, `O título deve ter no máximo ${LIMITS.taskTitle} caracteres`);

/** String opcional: vazio/null viram `null` (limpa o campo); `undefined` = não informado. */
const descriptionSchema = z
  .string()
  .trim()
  .max(LIMITS.taskDescription, `A descrição deve ter no máximo ${LIMITS.taskDescription} caracteres`)
  .nullish()
  .transform((v) => (v === undefined ? undefined : v || null));

/** Campo opcional que aceita "" / null para limpar. */
function clearable<T extends z.ZodTypeAny>(schema: T) {
  return z
    .union([schema, z.literal(""), z.null()])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "" ? null : (v as z.output<T> | null)));
}

const optionalDueDate = clearable(dueDateSchema);
const dueTimeSchema = clearable(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora inválida (HH:MM)"));
const estimateSchema = clearable(z.number().int("Estimativa inválida").min(0).max(100_000));
const recurrenceSchema = clearable(z.enum(RECURRENCES, { errorMap: () => ({ message: "Recorrência inválida" }) }));
const idListSchema = z.array(uuidSchema).max(50, "Itens demais").transform((ids) => [...new Set(ids)]);

export const createTaskSchema = z.object({
  title: titleSchema,
  description: descriptionSchema.transform((v) => v ?? null),
  priority: taskPrioritySchema.default("media"),
  status: taskStatusSchema.default("todo"),
  dueDate: optionalDueDate.transform((v) => v ?? null),
  projectId: uuidSchema.optional(),
  parentId: uuidSchema.nullish().transform((v) => v ?? null),
  startDate: optionalDueDate.transform((v) => v ?? null),
  dueTime: dueTimeSchema.transform((v) => v ?? null),
  estimateMinutes: estimateSchema.transform((v) => v ?? null),
  recurrence: recurrenceSchema.transform((v) => v ?? null),
  assigneeIds: idListSchema.optional(),
  labelIds: idListSchema.optional(),
});

const positionSchema = z
  .number({ invalid_type_error: "Posição inválida" })
  .int("Posição inválida")
  .min(0, "Posição inválida");

/**
 * PATCH parcial: só os campos enviados são alterados.
 * `status` e/ou `position` reposicionam a tarefa no quadro (arrastar e soltar).
 */
export const updateTaskSchema = z
  .object({
    title: titleSchema.optional(),
    description: descriptionSchema,
    priority: taskPrioritySchema.optional(),
    status: taskStatusSchema.optional(),
    position: positionSchema.optional(),
    dueDate: optionalDueDate,
    startDate: optionalDueDate,
    dueTime: dueTimeSchema,
    estimateMinutes: estimateSchema,
    recurrence: recurrenceSchema,
    projectId: uuidSchema.optional(),
    assigneeIds: idListSchema.optional(),
    labelIds: idListSchema.optional(),
    /** Versão conhecida pelo cliente (updatedAt): detecta edição concorrente. */
    expectedUpdatedAt: z.string().datetime({ offset: true }).optional(),
  })
  .strict("Campo não permitido")
  .refine(
    ({ expectedUpdatedAt: _v, ...data }) => Object.values(data).some((v) => v !== undefined),
    "Informe ao menos um campo para atualizar",
  );

/** Ações em massa (seleção múltipla no Kanban/lista). */
export const bulkTaskSchema = z.object({
  ids: z.array(uuidSchema).min(1, "Selecione ao menos uma tarefa").max(200),
  action: z.enum(["status", "priority", "assign", "archive", "delete"]),
  status: taskStatusSchema.optional(),
  priority: taskPrioritySchema.optional(),
  assigneeId: uuidSchema.optional(),
});

/** Importação em lote (ex.: tarefas antigas salvas no localStorage). */
export const importTasksSchema = z.object({
  tasks: z
    .array(createTaskSchema)
    .min(1, "Nenhuma tarefa para importar")
    .max(500, "Importe no máximo 500 tarefas por vez"),
});

export const taskQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  status: taskStatusSchema.optional(),
  priority: taskPrioritySchema.optional(),
  projectId: uuidSchema.optional(),
  /** "me" = tarefas atribuídas ao usuário autenticado. */
  assigneeId: z.union([z.literal("me"), uuidSchema]).optional(),
  labelId: uuidSchema.optional(),
  due: z.enum(["overdue", "today", "week", "none"]).optional(),
  view: z.enum(["active", "archived", "trash"]).default("active"),
  /** Inclui subtarefas na listagem (por padrão só as principais). */
  includeSubtasks: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
  from: dueDateSchema.optional(),
  to: dueDateSchema.optional(),
});

export const checklistItemSchema = z.object({
  content: z.string().trim().min(1, "Escreva o item").max(LIMITS.checklistItem),
});

export const updateChecklistItemSchema = z
  .object({
    content: z.string().trim().min(1).max(LIMITS.checklistItem).optional(),
    done: z.boolean().optional(),
    position: positionSchema.optional(),
  })
  .strict();

export const commentSchema = z.object({
  body: z.string().trim().min(1, "Escreva um comentário").max(LIMITS.comment),
  parentId: uuidSchema.optional(),
});

export const reactionSchema = z.object({
  emoji: z.string().min(1).max(16),
});

export const dependencySchema = z.object({ dependsOnId: uuidSchema });

export type CreateTaskInput = z.input<typeof createTaskSchema>;
export type UpdateTaskInput = z.input<typeof updateTaskSchema>;
export type ImportTasksInput = z.input<typeof importTasksSchema>;
export type BulkTaskInput = z.input<typeof bulkTaskSchema>;
export type TaskQuery = z.infer<typeof taskQuerySchema>;
export type TaskQueryInput = z.input<typeof taskQuerySchema>;
