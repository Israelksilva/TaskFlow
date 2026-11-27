import { env } from "../../config/env";
import type { Mail } from "./mailer";

/**
 * Modelos de e-mail com a marca Andamo. HTML em tabelas e estilos inline (compatível com Gmail,
 * Outlook e Apple Mail), largura máxima de 560 px e versão em texto puro.
 */

const BRAND = "#6D5DFC";
const TEXT = "#1E1B3A";
const MUTED = "#5B5876";

const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Link para uma rota do front (HashRouter). */
export const appLink = (route: string, params: Record<string, string> = {}) => {
  const qs = new URLSearchParams(params).toString();
  return `${env.APP_URL.replace(/\/?$/, "/")}#${route}${qs ? `?${qs}` : ""}`;
};

interface Layout {
  preheader: string;
  title: string;
  paragraphs: string[];
  action?: { label: string; url: string };
  footnote?: string;
}

function render({ preheader, title, paragraphs, action, footnote }: Layout): { html: string; text: string } {
  const p = paragraphs
    .map((t) => `<p style="margin:0 0 16px;font-size:16px;line-height:24px;color:${TEXT}">${escape(t)}</p>`)
    .join("");
  const button = action
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px"><tr><td style="border-radius:10px;background:${BRAND}">
        <a href="${escape(action.url)}" style="display:inline-block;padding:14px 28px;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px">${escape(action.label)}</a>
      </td></tr></table>
      <p style="margin:0 0 16px;font-size:13px;line-height:20px;color:${MUTED}">Se o botão não funcionar, copie e cole este endereço no navegador:<br><a href="${escape(action.url)}" style="color:${BRAND};word-break:break-all">${escape(action.url)}</a></p>`
    : "";
  const note = footnote
    ? `<p style="margin:16px 0 0;font-size:13px;line-height:20px;color:${MUTED}">${escape(footnote)}</p>`
    : "";

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escape(title)}</title></head>
<body style="margin:0;padding:0;background:#F4F3FF;font-family:Inter,-apple-system,'Segoe UI',Roboto,Arial,sans-serif">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escape(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F3FF"><tr><td align="center" style="padding:32px 16px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
    <tr><td style="padding:0 8px 20px;font-size:22px;font-weight:800;color:${BRAND};letter-spacing:-0.02em">Andamo</td></tr>
    <tr><td style="background:#ffffff;border-radius:16px;padding:32px;border:1px solid #E7E5FF">
      <h1 style="margin:0 0 20px;font-size:22px;line-height:30px;color:${TEXT}">${escape(title)}</h1>
      ${p}${button}${note}
    </td></tr>
    <tr><td style="padding:20px 8px 0;font-size:12px;line-height:18px;color:${MUTED}">Você recebeu este e-mail por causa da sua conta no Andamo. Não responda: esta caixa não é monitorada.</td></tr>
  </table>
</td></tr></table></body></html>`;

  const text = [title, "", ...paragraphs, ...(action ? ["", `${action.label}: ${action.url}`] : []), ...(footnote ? ["", footnote] : [])].join("\n");
  return { html, text };
}

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

export function verifyEmailMail(to: string, name: string, token: string): Mail {
  const url = appLink("/verificar-email", { token });
  return {
    to,
    template: "verify_email",
    subject: "Confirme seu e-mail no Andamo",
    ...render({
      preheader: "Falta só um passo para confirmar sua conta.",
      title: `Olá, ${firstName(name)}! Confirme seu e-mail`,
      paragraphs: ["Para proteger sua conta e permitir a recuperação de senha, confirme que este e-mail é seu."],
      action: { label: "Confirmar e-mail", url },
      footnote: "O link vale por 24 horas. Se você não criou uma conta no Andamo, ignore esta mensagem.",
    }),
  };
}

export function resetPasswordMail(to: string, name: string, token: string): Mail {
  const url = appLink("/redefinir-senha", { token });
  return {
    to,
    template: "reset_password",
    subject: "Redefinição de senha do Andamo",
    ...render({
      preheader: "Use o link para criar uma nova senha.",
      title: `Olá, ${firstName(name)}! Vamos criar uma nova senha`,
      paragraphs: ["Recebemos um pedido para redefinir a senha da sua conta."],
      action: { label: "Criar nova senha", url },
      footnote:
        "O link vale por 30 minutos e só pode ser usado uma vez. Se não foi você, ignore este e-mail: sua senha continua a mesma.",
    }),
  };
}

export function securityNoticeMail(to: string, name: string, event: "password_changed" | "2fa_enabled" | "2fa_disabled"): Mail {
  const texts = {
    password_changed: ["Sua senha foi alterada", "A senha da sua conta acabou de ser alterada e as outras sessões foram encerradas."],
    "2fa_enabled": ["Verificação em duas etapas ativada", "A verificação em duas etapas foi ativada na sua conta."],
    "2fa_disabled": ["Verificação em duas etapas desativada", "A verificação em duas etapas foi desativada na sua conta."],
  } as const;
  const [title, body] = texts[event];
  return {
    to,
    template: event,
    subject: `${title} — Andamo`,
    ...render({
      preheader: body,
      title,
      paragraphs: [`Olá, ${firstName(name)}.`, body],
      action: { label: "Revisar segurança da conta", url: appLink("/app/configuracoes", { aba: "seguranca" }) },
      footnote: "Se não foi você, redefina sua senha imediatamente e encerre as sessões desconhecidas.",
    }),
  };
}
