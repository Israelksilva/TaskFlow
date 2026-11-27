import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { contactSchema, type PublicConfig } from "@andamo/shared";
import { env, integrations, isTest } from "../../config/env";
import { db } from "../../db";
import { clientInfo } from "../../shared/http";
import { parse } from "../../shared/validation";
import { queueEmail } from "../email/email.service";
import { emailTemplates } from "../email/templates";

export const publicRoutes = Router();

/** Configuração pública: o front-end só mostra recursos cujas integrações estão de fato ativas. */
publicRoutes.get("/config", (_req, res) => {
  const config: PublicConfig = {
    integrations: integrations.toJSON(),
    googleClientId: env.GOOGLE_CLIENT_ID ?? null,
    vapidPublicKey: env.VAPID_PUBLIC_KEY ?? null,
  };
  res.set("Cache-Control", "public, max-age=300").json(config);
});

const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skip: () => isTest,
  message: { error: { code: "TOO_MANY_REQUESTS", message: "Você já enviou várias mensagens. Tente mais tarde." } },
});

/** Formulário de contato da landing page: grava no banco e avisa a equipe por e-mail (se configurado). */
publicRoutes.post("/contato", contactLimiter, async (req, res) => {
  const data = parse(contactSchema, req.body);
  // Campo-isca preenchido = robô: respondemos OK sem gravar.
  if (data.website) return void res.status(202).json({ ok: true });
  await db.query(
    `INSERT INTO contact_messages (name, email, subject, message, ip) VALUES ($1, $2, $3, $4, $5)`,
    [data.name, data.email, data.subject, data.message, clientInfo(req).ip],
  );
  if (env.CONTACT_EMAIL) {
    const email = emailTemplates.contact(data.name, data.email, data.subject, data.message);
    await queueEmail(env.CONTACT_EMAIL, email);
  }
  res.status(202).json({ ok: true });
});
