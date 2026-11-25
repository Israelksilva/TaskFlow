import { z } from "zod";

/** Variáveis opcionais: string vazia conta como "não configurado". */
const optional = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() ? v.trim() : undefined));

const bool = (fallback: boolean) =>
  z
    .enum(["true", "false", "1", "0"])
    .optional()
    .transform((v) => (v === undefined ? fallback : v === "true" || v === "1"));

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    PORT: z.coerce.number().int().positive().default(3333),
    DATABASE_URL: z
      .string({ required_error: "DATABASE_URL é obrigatória (connection string do Neon)" })
      .min(1, "DATABASE_URL é obrigatória (connection string do Neon)")
      .refine(
        (url) => /^(postgres(ql)?|pglite):\/\//.test(url),
        "Use postgresql://... (Neon) ou pglite://... (Postgres embutido para desenvolvimento)",
      ),
    JWT_SECRET: z.string().min(32, "JWT_SECRET deve ter ao menos 32 caracteres"),
    /** Vida curta do access token; a sessão continua com o refresh token. */
    ACCESS_TOKEN_TTL: z.string().default("15m"),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
    /** Chave (32+ caracteres) para cifrar segredos em repouso (ex.: 2FA). Padrão: derivada do JWT_SECRET. */
    ENCRYPTION_KEY: optional,
    CORS_ORIGIN: z
      .string()
      .default("http://localhost:8080")
      .transform((value) =>
        value
          .split(",")
          .map((origin) => origin.trim())
          .filter(Boolean),
      ),
    /** URL pública do front-end (links em e-mails e notificações push). */
    APP_URL: z.string().url().default("http://localhost:8080"),
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .default("info"),

    // ---- Fila de jobs (PostgreSQL) — roda no mesmo processo da API por padrão.
    WORKER_ENABLED: bool(true),
    WORKER_POLL_MS: z.coerce.number().int().min(200).default(5000),

    // ---- E-mail (Resend). Sem chave, os e-mails são apenas registrados no log.
    RESEND_API_KEY: optional,
    EMAIL_FROM: z.string().default("Andamo <no-reply@andamo.app>"),

    // ---- Web Push (VAPID). Gere com: npx web-push generate-vapid-keys
    VAPID_PUBLIC_KEY: optional,
    VAPID_PRIVATE_KEY: optional,
    VAPID_SUBJECT: z.string().default("mailto:suporte@andamo.app"),

    // ---- Login com Google (OAuth Client ID do tipo "Aplicativo da Web").
    GOOGLE_CLIENT_ID: optional,

    // ---- Formulário de contato da landing page (destino das mensagens).
    CONTACT_EMAIL: optional,
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === "production" && env.JWT_SECRET.startsWith("troque-este-segredo")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["JWT_SECRET"],
        message: "Defina um JWT_SECRET real em produção",
      });
    }
    if (env.NODE_ENV === "production" && env.DATABASE_URL.startsWith("pglite://")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["DATABASE_URL"],
        message: "Em produção use o PostgreSQL do Neon (postgresql://...)",
      });
    }
    if (env.ENCRYPTION_KEY && env.ENCRYPTION_KEY.length < 32) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ENCRYPTION_KEY"],
        message: "ENCRYPTION_KEY deve ter ao menos 32 caracteres",
      });
    }
    if (Boolean(env.VAPID_PUBLIC_KEY) !== Boolean(env.VAPID_PRIVATE_KEY)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["VAPID_PRIVATE_KEY"],
        message: "Defina VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY juntas",
      });
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Variáveis de ambiente inválidas:");
  for (const [key, errors] of Object.entries(parsed.error.flatten().fieldErrors)) {
    console.error(`   ${key}: ${errors?.join(", ")}`);
  }
  console.error("   Copie apps/api/.env.example para apps/api/.env e ajuste os valores.");
  process.exit(1);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === "production";
export const isTest = env.NODE_ENV === "test";

/** Quais integrações externas estão de fato configuradas (exposto em /health e /v1/config). */
export const integrations = {
  email: Boolean(env.RESEND_API_KEY),
  push: Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY),
  google: Boolean(env.GOOGLE_CLIENT_ID),
} as const;
