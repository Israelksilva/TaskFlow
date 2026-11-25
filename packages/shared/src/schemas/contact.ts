import { z } from "zod";
import { emailSchema } from "./auth";

export const CONTACT_TOPICS = ["duvida", "comercial", "suporte", "privacidade", "outro"] as const;
export type ContactTopic = (typeof CONTACT_TOPICS)[number];

export const CONTACT_TOPIC_LABELS: Record<ContactTopic, string> = {
  duvida: "Dúvida sobre o produto",
  comercial: "Comercial / planos",
  suporte: "Suporte técnico",
  privacidade: "Privacidade e dados pessoais",
  outro: "Outro assunto",
};

/** Tempo mínimo (ms) entre abrir o formulário e enviar: bots costumam enviar na hora. */
export const CONTACT_MIN_FILL_MS = 3000;

export const contactSchema = z.object({
  name: z
    .string({ error: "Informe seu nome" })
    .trim()
    .min(2, "Informe seu nome")
    .max(80, "O nome deve ter no máximo 80 caracteres"),
  email: emailSchema.max(254, "E-mail muito longo"),
  topic: z.enum(CONTACT_TOPICS, { error: "Escolha um assunto" }),
  message: z
    .string({ error: "Escreva sua mensagem" })
    .trim()
    .min(10, "Escreva ao menos 10 caracteres")
    .max(2000, "A mensagem deve ter no máximo 2000 caracteres"),
  consent: z.literal(true, { error: "É preciso concordar com a Política de Privacidade" }),
  /** Campo-isca invisível: pessoas deixam vazio, bots costumam preencher. */
  website: z.string().max(200).optional(),
  /** Milissegundos desde que o formulário foi aberto. */
  elapsedMs: z.number().int().nonnegative().optional(),
});

export type ContactInput = z.input<typeof contactSchema>;
