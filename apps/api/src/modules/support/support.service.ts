import type { SupportMessage, SupportTicket, TicketPriority, TicketStatus, TicketType } from "@andamo/shared";
import { TICKET_STATUS_LABELS } from "@andamo/shared";
import { db } from "../../db";
import { toISO } from "../../shared/dates";
import { BadRequestError, NotFoundError } from "../../shared/errors";
import { audit } from "../audit/audit";
import { notificationService } from "../notifications/notification.service";
import { workspaceRepository } from "../workspaces/workspace.repository";

interface TicketRow {
  id: string;
  type: TicketType;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  user_id: string | null;
  user_name: string | null;
  user_email: string | null;
  user_avatar: string | null;
  workspace_name: string | null;
  message_count: number;
  last_message_at: Date | string;
  created_at: Date | string;
  closed_at: Date | string | null;
}

const SELECT = `SELECT t.id, t.type, t.subject, t.status, t.priority, t.user_id, u.name AS user_name, u.email AS user_email,
    u.avatar_url AS user_avatar, w.name AS workspace_name,
    (SELECT count(*)::int FROM support_messages m WHERE m.ticket_id = t.id) AS message_count,
    COALESCE((SELECT max(m.created_at) FROM support_messages m WHERE m.ticket_id = t.id), t.created_at) AS last_message_at,
    t.created_at, t.closed_at
  FROM support_tickets t LEFT JOIN users u ON u.id = t.user_id LEFT JOIN workspaces w ON w.id = t.workspace_id`;

const toDTO = (r: TicketRow): SupportTicket => ({
  id: r.id,
  type: r.type,
  subject: r.subject,
  status: r.status,
  priority: r.priority,
  requester: r.user_id && r.user_name ? { id: r.user_id, name: r.user_name, avatarUrl: r.user_avatar, email: r.user_email ?? "" } : null,
  workspaceName: r.workspace_name,
  messageCount: r.message_count,
  lastMessageAt: toISO(r.last_message_at),
  createdAt: toISO(r.created_at),
  closedAt: r.closed_at ? toISO(r.closed_at) : null,
});

/** Quem atende: administradores da plataforma (recebem aviso de chamado novo). */
async function staffIds(): Promise<string[]> {
  const { rows } = await db.query<{ id: string }>(`SELECT id FROM users WHERE is_platform_admin AND deleted_at IS NULL AND suspended_at IS NULL`);
  return rows.map((r) => r.id);
}

async function findForUser(userId: string, id: string): Promise<TicketRow> {
  const { rows } = await db.query<TicketRow>(`${SELECT} WHERE t.id = $1 AND t.user_id = $2`, [id, userId]);
  if (!rows[0]) throw new NotFoundError("Chamado");
  return rows[0];
}

async function findAny(id: string): Promise<TicketRow> {
  const { rows } = await db.query<TicketRow>(`${SELECT} WHERE t.id = $1`, [id]);
  if (!rows[0]) throw new NotFoundError("Chamado");
  return rows[0];
}

async function messages(ticketId: string): Promise<SupportMessage[]> {
  const { rows } = await db.query<{ id: string; author_id: string | null; name: string | null; avatar_url: string | null; is_staff: boolean; body: string; created_at: Date | string }>(
    `SELECT m.id, m.author_id, u.name, u.avatar_url, m.is_staff, m.body, m.created_at
     FROM support_messages m LEFT JOIN users u ON u.id = m.author_id WHERE m.ticket_id = $1 ORDER BY m.created_at`,
    [ticketId],
  );
  return rows.map((r) => ({
    id: r.id,
    // A equipe aparece como "Suporte Andamo" para o cliente (não expõe a conta pessoal do atendente).
    author: r.is_staff ? { id: "staff", name: "Suporte Andamo", avatarUrl: null } : r.author_id && r.name ? { id: r.author_id, name: r.name, avatarUrl: r.avatar_url } : null,
    isStaff: r.is_staff,
    body: r.body,
    createdAt: toISO(r.created_at),
  }));
}

export const supportService = {
  // ------------------------------------------------------------ cliente
  async listMine(userId: string): Promise<SupportTicket[]> {
    const { rows } = await db.query<TicketRow>(`${SELECT} WHERE t.user_id = $1 ORDER BY t.updated_at DESC LIMIT 100`, [userId]);
    return rows.map(toDTO);
  },

  async create(userId: string, input: { type: TicketType; subject: string; message: string; workspaceId?: string }): Promise<SupportTicket> {
    // Só associa o workspace se a pessoa for membro (evita citar workspaces alheios).
    const workspaceId = input.workspaceId && (await workspaceRepository.membership(input.workspaceId, userId)) ? input.workspaceId : null;
    const { rows: recent } = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM support_tickets WHERE user_id = $1 AND created_at > now() - interval '1 hour'`,
      [userId],
    );
    if (recent[0].n >= 10) throw new BadRequestError("Você abriu muitos chamados na última hora. Aguarde um pouco.", "TOO_MANY_TICKETS");
    const id = await db.transaction(async (tx) => {
      const { rows } = await tx.query<{ id: string }>(
        `INSERT INTO support_tickets (user_id, workspace_id, type, subject, priority) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [userId, workspaceId, input.type, input.subject, input.type === "bug" ? "high" : "normal"],
      );
      await tx.query(`INSERT INTO support_messages (ticket_id, author_id, body) VALUES ($1, $2, $3)`, [rows[0].id, userId, input.message]);
      return rows[0].id;
    });
    await notificationService.notify({
      userIds: await staffIds(), workspaceId: null, type: "support.new", category: "system",
      title: `Novo chamado: ${input.subject}`, body: input.message.slice(0, 160), link: `/app/admin/suporte?chamado=${id}`,
      actorId: userId, dedupeKey: `support.new:${id}`,
    });
    return toDTO(await findForUser(userId, id));
  },

  async getMine(userId: string, id: string) {
    return { ticket: toDTO(await findForUser(userId, id)), messages: await messages(id) };
  },

  async replyAsUser(userId: string, id: string, message: string) {
    const ticket = await findForUser(userId, id);
    if (ticket.status === "closed") throw new BadRequestError("Este chamado foi encerrado. Abra um novo, se precisar.");
    await db.query(`INSERT INTO support_messages (ticket_id, author_id, body) VALUES ($1, $2, $3)`, [id, userId, message]);
    // Resposta do cliente reabre o atendimento.
    await db.query(`UPDATE support_tickets SET status = CASE WHEN status IN ('waiting_user', 'resolved') THEN 'open' ELSE status END, updated_at = now() WHERE id = $1`, [id]);
    await notificationService.notify({
      userIds: await staffIds(), workspaceId: null, type: "support.reply", category: "system",
      title: `Resposta do cliente: ${ticket.subject}`, body: message.slice(0, 160), link: `/app/admin/suporte?chamado=${id}`,
      actorId: userId, dedupeKey: `support.user:${id}:${Date.now()}`,
    });
    return this.getMine(userId, id);
  },

  async closeMine(userId: string, id: string) {
    await findForUser(userId, id);
    await db.query(`UPDATE support_tickets SET status = 'closed', closed_at = now(), updated_at = now() WHERE id = $1`, [id]);
    return this.getMine(userId, id);
  },

  // ------------------------------------------------------------ equipe (administração)
  async listAll(q: { status?: TicketStatus | "active"; type?: TicketType }): Promise<SupportTicket[]> {
    const params: unknown[] = [];
    const where: string[] = [];
    if (q.status === "active") where.push("t.status IN ('open', 'in_progress', 'waiting_user')");
    else if (q.status) {
      params.push(q.status);
      where.push(`t.status = $${params.length}`);
    }
    if (q.type) {
      params.push(q.type);
      where.push(`t.type = $${params.length}`);
    }
    const { rows } = await db.query<TicketRow>(
      `${SELECT} ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
       ORDER BY CASE t.priority WHEN 'high' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END, t.updated_at DESC LIMIT 200`,
      params,
    );
    return rows.map(toDTO);
  },

  async getAny(id: string) {
    return { ticket: toDTO(await findAny(id)), messages: await messages(id) };
  },

  async replyAsStaff(adminId: string, id: string, message: string, ip: string | null) {
    const ticket = await findAny(id);
    await db.query(`INSERT INTO support_messages (ticket_id, author_id, is_staff, body) VALUES ($1, $2, true, $3)`, [id, adminId, message]);
    await db.query(`UPDATE support_tickets SET status = 'waiting_user', updated_at = now() WHERE id = $1`, [id]);
    await audit({ actorId: adminId, action: "admin.support_reply", target: id, ip });
    if (ticket.user_id) {
      await notificationService.notify({
        userIds: [ticket.user_id], workspaceId: null, type: "support.reply", category: "system",
        title: `O suporte respondeu: ${ticket.subject}`, body: message.slice(0, 160), link: `/app/suporte?chamado=${id}`,
        dedupeKey: `support.staff:${id}:${Date.now()}`,
      });
    }
    return this.getAny(id);
  },

  async updateAsStaff(adminId: string, id: string, data: { status?: TicketStatus; priority?: TicketPriority }, ip: string | null) {
    const ticket = await findAny(id);
    await db.query(
      `UPDATE support_tickets SET status = COALESCE($2, status), priority = COALESCE($3, priority), updated_at = now(),
         closed_at = CASE WHEN COALESCE($2, status) = 'closed' THEN COALESCE(closed_at, now()) ELSE NULL END
       WHERE id = $1`,
      [id, data.status ?? null, data.priority ?? null],
    );
    await audit({ actorId: adminId, action: "admin.support_update", target: id, ip, data });
    if (data.status && data.status !== ticket.status && ticket.user_id && ["resolved", "closed"].includes(data.status)) {
      await notificationService.notify({
        userIds: [ticket.user_id], workspaceId: null, type: "support.status", category: "system",
        title: `Chamado ${TICKET_STATUS_LABELS[data.status].toLowerCase()}: ${ticket.subject}`, link: `/app/suporte?chamado=${id}`,
        dedupeKey: `support.status:${id}:${data.status}:${Date.now()}`,
      });
    }
    return this.getAny(id);
  },
};
