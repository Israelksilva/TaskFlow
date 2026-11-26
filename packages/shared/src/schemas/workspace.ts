import { z } from "zod";
import { LIMITS, PROJECT_STATUSES } from "../constants";
import { ROLES } from "../rbac";
import { emailSchema } from "./auth";
import { dueDateSchema, taskPrioritySchema, uuidSchema } from "./task";

const colorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida (use #RRGGBB)");
const httpsUrl = z
  .string()
  .trim()
  .url("URL inválida")
  .max(500)
  .refine((u) => u.startsWith("https://"), "Use uma URL https://");

export const roleSchema = z.enum(ROLES, { errorMap: () => ({ message: "Papel inválido" }) });
export const invitableRoleSchema = roleSchema.refine((r) => r !== "owner", "Use a transferência de propriedade");

export const createWorkspaceSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome").max(LIMITS.workspaceName),
});

export const updateWorkspaceSchema = z
  .object({
    name: z.string().trim().min(2).max(LIMITS.workspaceName).optional(),
    logoUrl: httpsUrl.nullable().optional(),
  })
  .strict();

export const transferOwnershipSchema = z.object({ userId: uuidSchema });

export const inviteSchema = z.object({
  email: emailSchema,
  role: invitableRoleSchema.default("member"),
});

export const acceptInvitationSchema = z.object({ token: z.string().min(10).max(200) });

export const updateMemberSchema = z
  .object({
    role: invitableRoleSchema.optional(),
    jobTitle: z.string().trim().max(80).nullable().optional(),
    department: z.string().trim().max(80).nullable().optional(),
    capacityHours: z.number().int().min(0).max(168).nullable().optional(),
  })
  .strict();

export const teamSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome").max(60),
  description: z.string().trim().max(280).nullish().transform((v) => v || null),
  color: colorSchema.default("#6D5DFC"),
  memberIds: z.array(uuidSchema).max(500).optional(),
});

export const labelSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome").max(40),
  color: colorSchema.default("#6D5DFC"),
});

const clearableDate = z
  .union([dueDateSchema, z.literal(""), z.null()])
  .optional()
  .transform((v) => (v === undefined ? undefined : v || null));

const projectFields = {
  name: z.string().trim().min(1, "Informe o nome").max(LIMITS.projectName),
  description: z.string().trim().max(LIMITS.projectDescription).nullish().transform((v) => (v === undefined ? undefined : v || null)),
  goal: z.string().trim().max(500).nullish().transform((v) => (v === undefined ? undefined : v || null)),
  icon: z.string().trim().regex(/^[a-z0-9-]{1,32}$/, "Ícone inválido"),
  color: colorSchema,
  status: z.enum(PROJECT_STATUSES, { errorMap: () => ({ message: "Status inválido" }) }),
  priority: taskPrioritySchema,
  startDate: clearableDate,
  dueDate: clearableDate,
  ownerId: uuidSchema.nullable(),
  teamId: uuidSchema.nullable(),
  isTemplate: z.boolean(),
};

const datesInOrder = (d: { startDate?: string | null; dueDate?: string | null }) =>
  !d.startDate || !d.dueDate || d.dueDate >= d.startDate;

export const createProjectSchema = z
  .object({
    ...projectFields,
    icon: projectFields.icon.default("folder"),
    color: projectFields.color.default("#6D5DFC"),
    status: projectFields.status.default("active"),
    priority: projectFields.priority.default("media"),
    ownerId: projectFields.ownerId.optional(),
    teamId: projectFields.teamId.optional(),
    isTemplate: projectFields.isTemplate.default(false),
    /** Cria a partir de um projeto-modelo (copia as tarefas). */
    templateId: uuidSchema.optional(),
  })
  .refine(datesInOrder, { path: ["dueDate"], message: "A conclusão deve ser depois do início" });

export const updateProjectSchema = z
  .object({
    name: projectFields.name.optional(),
    description: projectFields.description,
    goal: projectFields.goal,
    icon: projectFields.icon.optional(),
    color: projectFields.color.optional(),
    status: projectFields.status.optional(),
    priority: projectFields.priority.optional(),
    startDate: projectFields.startDate,
    dueDate: projectFields.dueDate,
    ownerId: projectFields.ownerId.optional(),
    teamId: projectFields.teamId.optional(),
    isTemplate: projectFields.isTemplate.optional(),
  })
  .strict()
  .refine(datesInOrder, { path: ["dueDate"], message: "A conclusão deve ser depois do início" });

export const dashboardQuerySchema = z.object({
  period: z.enum(["7d", "30d", "90d"]).default("30d"),
  projectId: uuidSchema.optional(),
  assigneeId: uuidSchema.optional(),
});

/** Relatórios: período livre (até 1 ano) comparado automaticamente com o período anterior de mesma duração. */
export const reportQuerySchema = z
  .object({
    from: dueDateSchema,
    to: dueDateSchema,
    projectId: uuidSchema.optional(),
    assigneeId: uuidSchema.optional(),
  })
  .refine((q) => q.to >= q.from, { path: ["to"], message: "O fim deve ser depois do início" })
  .refine((q) => (Date.parse(q.to) - Date.parse(q.from)) / 864e5 <= 366, { path: ["to"], message: "Período máximo de 1 ano" });

export const searchQuerySchema = z.object({
  q: z.string().trim().min(2, "Digite ao menos 2 caracteres").max(100),
});

export const cursorQuerySchema = z.object({
  cursor: z.string().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export type CreateWorkspaceInput = z.input<typeof createWorkspaceSchema>;
export type UpdateWorkspaceInput = z.input<typeof updateWorkspaceSchema>;
export type InviteInput = z.input<typeof inviteSchema>;
export type UpdateMemberInput = z.input<typeof updateMemberSchema>;
export type TeamInput = z.input<typeof teamSchema>;
export type LabelInput = z.input<typeof labelSchema>;
export type CreateProjectInput = z.input<typeof createProjectSchema>;
export type UpdateProjectInput = z.input<typeof updateProjectSchema>;
export type DashboardQuery = z.input<typeof dashboardQuerySchema>;
export type ReportQuery = z.input<typeof reportQuerySchema>;
