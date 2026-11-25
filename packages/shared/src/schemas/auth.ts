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
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string({ error: "Informe a senha" }).min(1, "Informe a senha"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
