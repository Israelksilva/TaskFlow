import { z } from "zod";
import { LIMITS } from "../constants";

export const emailSchema = z
  .string({ required_error: "Informe o e-mail" })
  .trim()
  .toLowerCase()
  .email("E-mail inválido")
  .max(254, "E-mail muito longo");

export const passwordSchema = z
  .string({ required_error: "Informe a senha" })
  .min(LIMITS.passwordMin, `A senha deve ter ao menos ${LIMITS.passwordMin} caracteres`)
  .max(LIMITS.passwordMax, `A senha deve ter no máximo ${LIMITS.passwordMax} caracteres`)
  .regex(/[A-Za-z]/, "A senha deve conter ao menos uma letra")
  .regex(/\d/, "A senha deve conter ao menos um número");

export const nameSchema = z
  .string({ required_error: "Informe o nome" })
  .trim()
  .min(2, "O nome deve ter ao menos 2 caracteres")
  .max(LIMITS.userName, `O nome deve ter no máximo ${LIMITS.userName} caracteres`);

export const registerSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string({ required_error: "Informe a senha" }).min(1, "Informe a senha").max(200),
});

const tokenSchema = z.string({ required_error: "Token ausente" }).min(10, "Token inválido").max(200, "Token inválido");
const totpSchema = z.string().trim().regex(/^\d{6}$/, "Informe os 6 dígitos do aplicativo autenticador");

export const mfaLoginSchema = z.object({ mfaToken: tokenSchema, code: totpSchema });
export const refreshSchema = z.object({ refreshToken: tokenSchema });
export const logoutSchema = z.object({ refreshToken: tokenSchema.optional() });
export const forgotPasswordSchema = z.object({ email: emailSchema });
export const resetPasswordSchema = z.object({ token: tokenSchema, password: passwordSchema });
export const verifyEmailSchema = z.object({ token: tokenSchema });
export const googleLoginSchema = z.object({ credential: z.string().min(20).max(4096) });
export const enableTwoFactorSchema = z.object({ code: totpSchema });
export const disableTwoFactorSchema = z.object({ code: totpSchema });

export const changePasswordSchema = z.object({
  currentPassword: z.string().max(200).optional(),
  newPassword: passwordSchema,
});

export const updateProfileSchema = z
  .object({
    name: nameSchema.optional(),
    avatarUrl: z
      .string()
      .trim()
      .url("URL inválida")
      .max(500)
      .refine((u) => u.startsWith("https://"), "Use uma URL https://")
      .nullable()
      .optional(),
    locale: z.enum(["pt-BR", "en-US", "es-ES"]).optional(),
    timezone: z
      .string()
      .max(64)
      .refine((tz) => {
        try {
          new Intl.DateTimeFormat("en-US", { timeZone: tz });
          return true;
        } catch {
          return false;
        }
      }, "Fuso horário inválido")
      .optional(),
  })
  .strict("Campo não permitido");

export const deleteAccountSchema = z.object({
  password: z.string().max(200).optional(),
  confirmation: z.literal("EXCLUIR", { errorMap: () => ({ message: "Digite EXCLUIR para confirmar" }) }),
});

export const contactSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  subject: z.string().trim().min(3, "Informe o assunto").max(120),
  message: z.string().trim().min(10, "Escreva ao menos 10 caracteres").max(4000),
  /** Campo-isca anti-spam: deve vir vazio. */
  website: z.string().max(0).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type ContactInput = z.infer<typeof contactSchema>;
