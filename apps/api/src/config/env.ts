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
    JWT_EXPIRES_IN: z.string().default("7d"),
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
