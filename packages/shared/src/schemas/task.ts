import { z } from "zod";
import { LIMITS, TASK_PRIORITIES, TASK_STATUSES } from "../constants";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const taskStatusSchema = z.enum(TASK_STATUSES, {
  error: "Status inválido",
});

export const taskPrioritySchema = z.enum(TASK_PRIORITIES, {
  error: "Prioridade inválida",
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
  .string({ error: "Informe o título" })
  .trim()
  .min(1, "Informe o título")
  .max(LIMITS.taskTitle, `O título deve ter no máximo ${LIMITS.taskTitle} caracteres`);

/** String opcional: vazio/null viram `null` (limpa o campo); `undefined` = não informado. */
const descriptionSchema = z
  .string()
  .trim()
  .max(
    LIMITS.taskDescription,
    `A descrição deve ter no máximo ${LIMITS.taskDescription} caracteres`,
  )
  .nullish()
  .transform((v) => (v === undefined ? undefined : v || null));

const optionalDueDate = z
  .union([dueDateSchema, z.literal(""), z.null()])
  .optional()
  .transform((v) => (v === undefined ? undefined : v || null));

export const createTaskSchema = z.object({
  title: titleSchema,
  description: descriptionSchema.transform((v) => v ?? null),
  priority: taskPrioritySchema.default("media"),
  status: taskStatusSchema.default("todo"),
  dueDate: optionalDueDate.transform((v) => v ?? null),
});

const positionSchema = z
  .number({ error: "Posição inválida" })
  .int("Posição inválida")
  .min(0, "Posição inválida");

/**
 * PATCH parcial: só os campos enviados são alterados.
 * `status` e/ou `position` reposicionam a tarefa no quadro (arrastar e soltar).
 */
export const updateTaskSchema = z
  .strictObject(
    {
      title: titleSchema.optional(),
      description: descriptionSchema,
      priority: taskPrioritySchema.optional(),
      status: taskStatusSchema.optional(),
      position: positionSchema.optional(),
      dueDate: optionalDueDate,
    },
    {
      error: (issue) => (issue.code === "unrecognized_keys" ? "Campo não permitido" : undefined),
    },
  )
  .refine(
    (data) => Object.values(data).some((v) => v !== undefined),
    "Informe ao menos um campo para atualizar",
  );

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
});

export type CreateTaskInput = z.input<typeof createTaskSchema>;
export type UpdateTaskInput = z.input<typeof updateTaskSchema>;
export type ImportTasksInput = z.input<typeof importTasksSchema>;
export type TaskQuery = z.infer<typeof taskQuerySchema>;
