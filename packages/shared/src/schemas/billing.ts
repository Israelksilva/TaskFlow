import { z } from "zod";
import { uuidSchema } from "./task";

export const checkoutSchema = z.object({
  plan: z.enum(["pro", "business"]),
  /** No modo teste, o e-mail do COMPRADOR DE TESTE do Mercado Pago. */
  payerEmail: z.string().trim().toLowerCase().email("Informe um e-mail válido").max(254),
});

/** Limite por arquivo (o total por workspace segue o plano). */
export const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024;

/** Tipos bloqueados: executáveis e scripts não são aceitos como anexo. */
export const BLOCKED_EXTENSIONS = ["exe", "msi", "bat", "cmd", "com", "scr", "ps1", "vbs", "js", "jar", "sh", "apk", "dll"] as const;

export const createAttachmentSchema = z
  .object({
    projectId: uuidSchema,
    taskId: uuidSchema.optional(),
    fileName: z.string().trim().min(1).max(200),
    contentType: z.string().trim().max(150).regex(/^[\w.+-]+\/[\w.+-]+$/, "Tipo de arquivo inválido").default("application/octet-stream"),
    sizeBytes: z.number().int().positive().max(MAX_ATTACHMENT_BYTES, "Arquivo maior que 50 MB"),
  })
  .refine((a) => !BLOCKED_EXTENSIONS.includes((a.fileName.split(".").pop() ?? "").toLowerCase() as (typeof BLOCKED_EXTENSIONS)[number]), {
    path: ["fileName"],
    message: "Este tipo de arquivo não é permitido",
  });

export const attachmentQuerySchema = z.object({ projectId: uuidSchema.optional(), taskId: uuidSchema.optional() }).refine((q) => q.projectId || q.taskId, "Informe projectId ou taskId");

export type CheckoutInput = z.input<typeof checkoutSchema>;
export type CreateAttachmentInput = z.input<typeof createAttachmentSchema>;
