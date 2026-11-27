import { z } from "zod";
import { LIMITS } from "../constants";

export const emailSchema = z
  .string({ error: "Informe o e-mail" })
  .trim()
  .toLowerCase()
  .email({ error: "E-mail inválido" });

export const passwordSchema = z
  .string({ error: "Informe a senha" })
  .min(LIMITS.passwordMin, `A senha deve ter ao menos ${LIMITS.passwordMin} caracteres`)
  .max(LIMITS.passwordMax, `A senha deve ter no máximo ${LIMITS.passwordMax} caracteres`)
  .regex(/[A-Za-z]/, "A senha deve conter ao menos uma letra")
  .regex(/\d/, "A senha deve conter ao menos um número");

export const registerSchema = z.object({
  name: z
    .string({ error: "Informe o nome" })
    .trim()
    .min(2, "O nome deve ter ao menos 2 caracteres")
    .max(LIMITS.userName, `O nome deve ter no máximo ${LIMITS.userName} caracteres`),
  email: emailSchema,
  password: passwordSchema,
  /** "Manter conectado": sessão de 30 dias (renovada com o uso) em vez de 24 h. */
  remember: z.boolean().optional().default(false),
});

const currentPassword = z.string({ error: "Informe a senha" }).min(1, "Informe a senha").max(200);

export const loginSchema = z.object({
  email: emailSchema,
  password: currentPassword,
  remember: z.boolean().optional().default(false),
});

const opaqueToken = z.string({ error: "Token ausente" }).min(20, "Token inválido").max(200, "Token inválido");

export const refreshSchema = z.object({ refreshToken: opaqueToken });
export const logoutSchema = z.object({ refreshToken: opaqueToken.optional() });
export const tokenSchema = z.object({ token: opaqueToken });

export const forgotPasswordSchema = z.object({ email: emailSchema });
export const resetPasswordSchema = z.object({ token: opaqueToken, password: passwordSchema });

/** Código de 6 dígitos do app ou código de recuperação (XXXXX-XXXXX). */
export const totpCodeSchema = z
  .string({ error: "Informe o código" })
  .trim()
  .transform((v) => v.replace(/\s/g, ""))
  .pipe(z.string().regex(/^\d{6}$/, "O código tem 6 dígitos"));

export const mfaCodeSchema = z
  .string({ error: "Informe o código" })
  .trim()
  .transform((v) => v.replace(/\s/g, "").toUpperCase())
  .pipe(z.string().regex(/^(\d{6}|[A-Z0-9]{5}-[A-Z0-9]{5})$/, "Código inválido"));

export const mfaLoginSchema = z.object({ mfaToken: opaqueToken, code: mfaCodeSchema });

export const enableTwoFactorSchema = z.object({ code: totpCodeSchema });
export const confirmIdentitySchema = z.object({
  password: z.string().max(200).optional(),
  code: mfaCodeSchema.optional(),
});

export const SUPPORTED_LOCALES = ["pt-BR"] as const;

export const updateProfileSchema = z.strictObject(
  {
    name: registerSchema.shape.name.optional(),
    locale: z.enum(SUPPORTED_LOCALES, { error: "Idioma não suportado" }).optional(),
    timezone: z
      .string()
      .max(64)
      .refine((tz) => {
        try {
          new Intl.DateTimeFormat("pt-BR", { timeZone: tz });
          return true;
        } catch {
          return false;
        }
      }, "Fuso horário inválido")
      .optional(),
  },
  { error: (issue) => (issue.code === "unrecognized_keys" ? "Campo não permitido" : undefined) },
);

export const changePasswordSchema = z
  .object({ currentPassword: z.string().max(200).optional(), newPassword: passwordSchema })
  .refine((d) => d.currentPassword !== d.newPassword, {
    path: ["newPassword"],
    message: "A nova senha deve ser diferente da atual",
  });

export const googleStartSchema = z.object({ remember: z.boolean().optional().default(false) });
export const googleExchangeSchema = z.object({ code: opaqueToken });

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
