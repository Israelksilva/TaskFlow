import { env } from "../../config/env";

/** Escapa texto para inserção segura em HTML (nomes e títulos vêm dos usuários). */
export function escapeHtml(value: string): string {
  const map: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return value.replace(/[&<>"']/g, (c) => map[c]);
}

/** Link absoluto para o front-end (HashRouter: `/#/rota`). */
export const appLink = (path: string) =>
  `${env.APP_URL.replace(/\/$/, "")}/#${path.startsWith("/") ? path : `/${path}`}`;

interface Layout {
  preheader: string;
  heading: string;
  /** Parágrafos em texto puro (escapados aqui). */
  paragraphs: string[];
  cta?: { label: string; url: string };
  footnote?: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

function render(subject: string, l: Layout): RenderedEmail {
  const paragraphs = l.paragraphs
    .map((t) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#334155">${escapeHtml(t)}</p>`)
    .join("");
  const cta = l.cta
    ? `<p style="margin:24px 0"><a href="${escapeHtml(l.cta.url)}" style="display:inline-block;background:#6D5DFC;background-image:linear-gradient(135deg,#6D5DFC,#A646F0);color:#ffffff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:10px">${escapeHtml(l.cta.label)}</a></p>`
    : "";
  const foot = l.footnote
    ? `<p style="margin:16px 0 0;font-size:12px;color:#94a3b8">${escapeHtml(l.footnote)}</p>`
    : "";
  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f5f5fb;font-family:Inter,Segoe UI,Arial,sans-serif">
<span style="display:none;max-height:0;overflow:hidden">${escapeHtml(l.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:16px;border:1px solid #e7e7f3" cellpadding="0" cellspacing="0">
<tr><td style="padding:28px 32px 8px"><span style="font-size:20px;font-weight:800;color:#1e1b4b">Andamo</span><span style="color:#FF8A65;font-weight:800">.</span></td></tr>
<tr><td style="padding:8px 32px 28px"><h1 style="margin:0 0 16px;font-size:22px;color:#0f172a">${escapeHtml(l.heading)}</h1>${paragraphs}${cta}${foot}</td></tr>
</table>
<p style="font-size:12px;color:#94a3b8;margin:16px 0 0">Você recebeu este e-mail porque tem uma conta no Andamo. Ajuste suas preferências em Configurações → Notificações.</p>
</td></tr></table></body></html>`;
  const text = [
    l.heading,
    "",
    ...l.paragraphs,
    ...(l.cta ? ["", `${l.cta.label}: ${l.cta.url}`] : []),
    ...(l.footnote ? ["", l.footnote] : []),
  ].join("\n");
  return { subject, html, text };
}

export const emailTemplates = {
  verifyEmail: (name: string, token: string) =>
    render("Confirme seu e-mail no Andamo", {
      preheader: "Falta só um passo para ativar sua conta.",
      heading: `Boas-vindas, ${name}!`,
      paragraphs: ["Confirme seu endereço de e-mail para proteger sua conta e receber notificações."],
      cta: { label: "Confirmar e-mail", url: appLink(`/verificar-email?token=${token}`) },
      footnote: "O link expira em 48 horas. Se você não criou esta conta, ignore este e-mail.",
    }),

  resetPassword: (name: string, token: string) =>
    render("Redefinição de senha do Andamo", {
      preheader: "Recebemos um pedido para redefinir sua senha.",
      heading: "Redefinir sua senha",
      paragraphs: [`Olá, ${name}. Clique no botão abaixo para escolher uma nova senha.`],
      cta: { label: "Escolher nova senha", url: appLink(`/redefinir-senha?token=${token}`) },
      footnote: "O link expira em 1 hora e só pode ser usado uma vez. Se não foi você, nenhuma ação é necessária.",
    }),

  invitation: (inviter: string, workspace: string, token: string) =>
    render(`${inviter} convidou você para ${workspace} no Andamo`, {
      preheader: `Junte-se a ${workspace} no Andamo.`,
      heading: `Convite para ${workspace}`,
      paragraphs: [`${inviter} convidou você para colaborar no workspace “${workspace}”.`],
      cta: { label: "Aceitar convite", url: appLink(`/convite?token=${token}`) },
      footnote: "O convite expira em 7 dias.",
    }),

  /** Notificações (atribuição, menção, lembrete, atraso, alertas). */
  notification: (title: string, body: string | null, link: string | null) =>
    render(title, {
      preheader: body ?? title,
      heading: title,
      paragraphs: body ? [body] : [],
      cta: link ? { label: "Abrir no Andamo", url: appLink(link) } : undefined,
    }),

  digest: (period: "daily" | "weekly", name: string, items: Array<{ title: string; body: string | null }>) =>
    render(period === "daily" ? "Seu resumo diário do Andamo" : "Seu resumo semanal do Andamo", {
      preheader: `${items.length} atualização(ões) para você.`,
      heading: period === "daily" ? `Resumo do dia, ${name}` : `Resumo da semana, ${name}`,
      paragraphs: items.slice(0, 30).map((i) => (i.body ? `• ${i.title} — ${i.body}` : `• ${i.title}`)),
      cta: { label: "Ver notificações", url: appLink("/app/notificacoes") },
    }),

  contact: (name: string, email: string, subject: string, message: string) =>
    render(`[Contato] ${subject}`, {
      preheader: `Mensagem de ${name}`,
      heading: subject,
      paragraphs: [`De: ${name} <${email}>`, message],
    }),
};
