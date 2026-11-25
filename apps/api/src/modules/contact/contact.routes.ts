import { Router, type Request, type Response } from "express";
import { rateLimit } from "express-rate-limit";
import { CONTACT_MIN_FILL_MS, contactSchema } from "@andamo/shared";
import { env, isTest } from "../../config/env";
import { db } from "../../db";
import { parse } from "../../shared/validation";

/** Mensagens por hora por IP (CONTACT_LIMIT_PER_HOUR, padrão 5). */
const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: env.CONTACT_LIMIT_PER_HOUR,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skip: () => isTest,
  message: {
    error: {
      code: "TOO_MANY_REQUESTS",
      message: "Muitas mensagens enviadas. Tente novamente mais tarde.",
    },
  },
});

export const contactRoutes = Router();

/**
 * POST /contato — mensagem do formulário público.
 * Anti-spam: campo-isca, tempo mínimo de preenchimento e rate limit. Envios
 * suspeitos recebem a mesma resposta de sucesso, mas não são gravados
 * (não ensinamos o bot a contornar a regra).
 */
contactRoutes.post("/", contactLimiter, async (req: Request, res: Response) => {
  const input = parse(contactSchema, req.body);
  const suspicious =
    Boolean(input.website?.trim()) ||
    (input.elapsedMs !== undefined && input.elapsedMs < CONTACT_MIN_FILL_MS);

  if (suspicious) {
    req.log?.warn({ reason: "contact-spam" }, "Mensagem de contato descartada");
  } else {
    await db.query(
      "INSERT INTO contact_messages (name, email, topic, message) VALUES ($1, $2, $3, $4)",
      [input.name, input.email, input.topic, input.message],
    );
  }
  res.status(201).json({ ok: true });
});
