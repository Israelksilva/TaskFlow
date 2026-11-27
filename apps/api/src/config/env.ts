import { z } from "zod";

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    PORT: z.coerce.number().int().positive().default(3333),
    DATABASE_URL: z
      .string({ error: "DATABASE_URL é obrigatória (connection string do Neon)" })
      .min(1, "DATABASE_URL é obrigatória (connection string do Neon)")
      .refine(
        (url) => /^(postgres(ql)?|pglite):\/\//.test(url),
        "Use postgresql://... (Neon) ou pglite://... (Postgres embutido para desenvolvimento)",
      ),
    JWT_SECRET: z.string().min(32, "JWT_SECRET deve ter ao menos 32 caracteres"),
    /** Validade do token de acesso, em minutos. A sessão continua pelo refresh token. */
    ACCESS_TOKEN_TTL_MIN: z.coerce.number().int().min(1).max(60).default(15),
    /** Endereço público do front (links de e-mail e retorno do Google). Termina com "/". */
    APP_URL: z.url().default("http://localhost:8080/"),
    /** Endereço público da API (callback do Google). */
    API_PUBLIC_URL: z.url().default("http://localhost:3333"),
    /** Chave (64 caracteres hex) para cifrar segredos de 2FA. Sem ela, é derivada do JWT_SECRET. */
    DATA_ENCRYPTION_KEY: z
      .string()
      .regex(/^[0-9a-f]{64}$/i, "DATA_ENCRYPTION_KEY deve ter 64 caracteres hexadecimais")
      .optional(),
    /** E-mail transacional (Resend). Sem as duas, os e-mails só aparecem no log de desenvolvimento. */
    RESEND_API_KEY: z.string().min(1).optional(),
    MAIL_FROM: z.string().min(3).optional(),
    /** Login com Google (OAuth). Sem as duas, o botão não aparece. */
    GOOGLE_CLIENT_ID: z.string().min(1).optional(),
    GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
    CORS_ORIGIN: z
      .string()
      .default("http://localhost:8080")
      .transform((value) =>
        value
          .split(",")
          .map((origin) => origin.trim())
          .filter(Boolean),
      ),
    RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(300),
    AUTH_LIMIT_PER_15MIN: z.coerce.number().int().positive().default(20),
    CONTACT_LIMIT_PER_HOUR: z.coerce.number().int().positive().default(5),
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .default("info"),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === "production" && env.JWT_SECRET.startsWith("troque-este-segredo")) {
      ctx.addIssue({
        code: "custom",
        path: ["JWT_SECRET"],
        message: "Defina um JWT_SECRET real em produção",
      });
    }
    if (env.NODE_ENV === "production" && env.DATABASE_URL.startsWith("pglite://")) {
      ctx.addIssue({
        code: "custom",
        path: ["DATABASE_URL"],
        message: "Em produção use o PostgreSQL do Neon (postgresql://...)",
      });
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Variáveis de ambiente inválidas:");
  for (const [key, errors] of Object.entries(z.flattenError(parsed.error).fieldErrors)) {
    console.error(`   ${key}: ${errors?.join(", ")}`);
  }
  console.error("   Copie apps/api/.env.example para apps/api/.env e ajuste os valores.");
  process.exit(1);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === "production";
export const isTest = env.NODE_ENV === "test";
export const emailEnabled = Boolean(env.RESEND_API_KEY && env.MAIL_FROM);
export const googleEnabled = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
