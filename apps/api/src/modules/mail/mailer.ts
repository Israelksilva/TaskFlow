import { mkdirSync, writeFileSync } from "node:fs";
import { sha256 } from "../../lib/crypto";
import path from "node:path";
import { env, isProduction, isTest } from "../../config/env";
import { logger } from "../../lib/logger";

export interface Mail {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Identifica o modelo (útil em testes e logs; nunca o conteúdo). */
  template: string;
}

export interface Mailer {
  readonly name: string;
  send(mail: Mail): Promise<void>;
}

/** Resend (https://resend.com). A chave fica só no servidor. */
export class ResendMailer implements Mailer {
  readonly name = "resend";
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async send(mail: Mail) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: this.from, to: [mail.to], subject: mail.subject, html: mail.html, text: mail.text }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`Resend respondeu ${res.status}`);
  }
}

/** Desenvolvimento: grava o e-mail em `.data/mails/` e mostra o texto no log. */
export class DevMailer implements Mailer {
  readonly name = "dev";
  async send(mail: Mail) {
    const dir = path.resolve(".data/mails");
    mkdirSync(dir, { recursive: true });
    // Destinatário só como hash no nome do arquivo (os E2E acham o e-mail de cada pessoa por ele).
    const file = path.join(dir, `${Date.now()}-${mail.template}-${sha256(mail.to.toLowerCase()).slice(0, 12)}.html`);
    writeFileSync(file, mail.html);
    // Só o caminho: o texto tem links com token (nunca vão para o log).
    logger.info({ template: mail.template, file }, `✉️  ${mail.subject} — abra o arquivo para ver o e-mail`);
  }
}

/** Testes: guarda os e-mails em memória. */
export class MemoryMailer implements Mailer {
  readonly name = "memory";
  readonly sent: Mail[] = [];
  async send(mail: Mail) {
    this.sent.push(mail);
  }
  clear() {
    this.sent.length = 0;
  }
}

/** Produção sem Resend configurado: não envia e não registra o conteúdo (contém tokens). */
export class DisabledMailer implements Mailer {
  readonly name = "disabled";
  async send(mail: Mail) {
    logger.warn({ template: mail.template }, "E-mail não enviado: RESEND_API_KEY/MAIL_FROM não configurados");
  }
}

function createMailer(): Mailer {
  if (env.RESEND_API_KEY && env.MAIL_FROM) return new ResendMailer(env.RESEND_API_KEY, env.MAIL_FROM);
  if (isTest) return new MemoryMailer();
  if (isProduction) return new DisabledMailer();
  return new DevMailer();
}

export const mailer: Mailer = createMailer();

/**
 * Envia sem derrubar a requisição se o provedor falhar.
 * Temporário: na Fase 6 o envio passa a sair do outbox, com retentativas.
 */
export async function sendMail(mail: Mail) {
  try {
    await mailer.send(mail);
  } catch (error) {
    logger.error({ err: error, template: mail.template }, "Falha ao enviar e-mail");
  }
}
