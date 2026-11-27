import { PLAN_IDS, PLANS, type AdminAuditEntry, type AdminOverview, type AdminUser, type AdminWorkspace, type Announcement, type PlanId, type ServiceStatus } from "@andamo/shared";
import { integrations } from "../../config/env";
import { db } from "../../db";
import { enqueue, queueStats } from "../../jobs/queue";
import { registerJob } from "../../jobs/worker";
import { connectedCount, publishToUser } from "../../realtime/hub";
import { toISO } from "../../shared/dates";
import { BadRequestError, NotFoundError } from "../../shared/errors";
import { audit } from "../audit/audit";
import { sessionService } from "../auth/session.service";
import { notificationService } from "../notifications/notification.service";

const iso = (v: Date | string | null) => (v ? toISO(v) : null);

/**
 * Painel da plataforma. Privacidade: só dados de conta e agregados — nunca conteúdo de tarefas,
 * comentários ou arquivos dos clientes.
 */
export const adminService = {
  async overview(): Promise<AdminOverview> {
    const [users, ws, signups, cancels, support] = await Promise.all([
      db.query<{ total: number; active: number; new7: number; new30: number; suspended: number }>(
        `SELECT count(*)::int AS total,
           count(*) FILTER (WHERE last_login_at > now() - interval '30 days')::int AS active,
           count(*) FILTER (WHERE created_at > now() - interval '7 days')::int AS new7,
           count(*) FILTER (WHERE created_at > now() - interval '30 days')::int AS new30,
           count(*) FILTER (WHERE suspended_at IS NOT NULL)::int AS suspended
         FROM users WHERE deleted_at IS NULL`,
      ),
      db.query<{ plan: PlanId; total: number; team: number }>(
        `SELECT plan, count(*)::int AS total, count(*) FILTER (WHERE NOT is_personal)::int AS team
         FROM workspaces WHERE archived_at IS NULL GROUP BY plan`,
      ),
      db.query<{ date: string; count: number }>(
        `SELECT d::date::text AS date, (SELECT count(*)::int FROM users u WHERE u.created_at::date = d::date) AS count
         FROM generate_series(current_date - 29, current_date, interval '1 day') d ORDER BY d`,
      ),
      db.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM audit_log WHERE action = 'admin.plan_changed' AND created_at > now() - interval '30 days'
           AND data->>'to' = 'free' AND data->>'from' <> 'free'`,
      ),
      db.query<{ open: number; waiting: number }>(
        `SELECT count(*) FILTER (WHERE status IN ('open', 'in_progress'))::int AS open,
           count(*) FILTER (WHERE status = 'waiting_user')::int AS waiting FROM support_tickets`,
      ),
    ]);
    const byPlan = Object.fromEntries(PLAN_IDS.map((p) => [p, 0])) as Record<string, number>;
    let total = 0;
    let team = 0;
    let paidTeam = 0;
    let mrrCents = 0;
    for (const r of ws.rows) {
      byPlan[r.plan] = r.total;
      total += r.total;
      team += r.team;
      if (r.plan !== "free") {
        paidTeam += r.team;
        mrrCents += r.total * PLANS[r.plan].priceCents;
      }
    }
    const u = users.rows[0];
    return {
      users: { total: u.total, active30d: u.active, new7d: u.new7, new30d: u.new30, suspended: u.suspended },
      workspaces: { total, team, byPlan },
      subscriptions: total - byPlan.free,
      mrrCents,
      cancellations30d: cancels.rows[0].n,
      conversionRate: team ? Math.round((paidTeam / team) * 100) : 0,
      signups: signups.rows,
      support: support.rows[0],
    };
  },

  async users(q: { q?: string; status: "all" | "active" | "suspended"; cursor?: string }): Promise<{ items: AdminUser[]; nextCursor: string | null }> {
    const params: unknown[] = [];
    const where = ["u.deleted_at IS NULL"];
    if (q.q) {
      params.push(`%${q.q.toLowerCase().replace(/[%_\\]/g, "\\$&")}%`);
      where.push(`(lower(u.name) LIKE $${params.length} OR lower(u.email) LIKE $${params.length})`);
    }
    if (q.status === "suspended") where.push("u.suspended_at IS NOT NULL");
    if (q.status === "active") where.push("u.suspended_at IS NULL");
    if (q.cursor && !Number.isNaN(Date.parse(q.cursor))) {
      params.push(q.cursor);
      where.push(`u.created_at < $${params.length}::timestamptz`);
    }
    const { rows } = await db.query<{
      id: string; name: string; email: string; created_at: Date | string; last_login_at: Date | string | null;
      email_verified_at: Date | string | null; totp_enabled_at: Date | string | null; is_platform_admin: boolean;
      suspended_at: Date | string | null; workspaces: number;
    }>(
      `SELECT u.id, u.name, u.email, u.created_at, u.last_login_at, u.email_verified_at, u.totp_enabled_at,
         u.is_platform_admin, u.suspended_at, (SELECT count(*)::int FROM workspace_members m WHERE m.user_id = u.id) AS workspaces
       FROM users u WHERE ${where.join(" AND ")} ORDER BY u.created_at DESC LIMIT 51`,
      params,
    );
    const items = rows.slice(0, 50).map((r) => ({
      id: r.id, name: r.name, email: r.email, createdAt: toISO(r.created_at), lastLoginAt: iso(r.last_login_at),
      emailVerified: Boolean(r.email_verified_at), twoFactorEnabled: Boolean(r.totp_enabled_at), isPlatformAdmin: r.is_platform_admin,
      suspendedAt: iso(r.suspended_at), workspaceCount: r.workspaces,
    }));
    return { items, nextCursor: rows.length > 50 ? items[items.length - 1].createdAt : null };
  },

  /** Suspender encerra todas as sessões; reativar devolve o acesso. Nada é apagado. */
  async setSuspended(adminId: string, userId: string, suspended: boolean, reason: string, ip: string | null) {
    if (adminId === userId) throw new BadRequestError("Você não pode suspender a própria conta");
    const { rows } = await db.query<{ is_platform_admin: boolean }>(`SELECT is_platform_admin FROM users WHERE id = $1 AND deleted_at IS NULL`, [userId]);
    if (!rows[0]) throw new NotFoundError("Usuário");
    if (rows[0].is_platform_admin && suspended) throw new BadRequestError("Remova o acesso administrativo antes de suspender esta conta");
    await db.query(`UPDATE users SET suspended_at = CASE WHEN $2 THEN now() END, updated_at = now() WHERE id = $1`, [userId, suspended]);
    if (suspended) {
      await sessionService.revokeAll(userId, null);
      publishToUser(userId, { type: "session.revoked" });
    }
    await audit({ actorId: adminId, action: suspended ? "admin.user_suspended" : "admin.user_reactivated", target: userId, ip, data: { reason } });
  },

  async workspaces(q: { q?: string; plan?: PlanId }): Promise<AdminWorkspace[]> {
    const params: unknown[] = [];
    const where: string[] = [];
    if (q.q) {
      params.push(`%${q.q.toLowerCase().replace(/[%_\\]/g, "\\$&")}%`);
      where.push(`(lower(w.name) LIKE $${params.length} OR lower(o.email) LIKE $${params.length})`);
    }
    if (q.plan) {
      params.push(q.plan);
      where.push(`w.plan = $${params.length}`);
    }
    const { rows } = await db.query<{
      id: string; name: string; plan: PlanId; is_personal: boolean; owner_id: string | null; owner_name: string | null; owner_email: string | null;
      members: number; projects: number; created_at: Date | string; archived_at: Date | string | null;
    }>(
      `SELECT w.id, w.name, w.plan, w.is_personal, o.id AS owner_id, o.name AS owner_name, o.email AS owner_email,
         (SELECT count(*)::int FROM workspace_members m WHERE m.workspace_id = w.id) AS members,
         (SELECT count(*)::int FROM projects p WHERE p.workspace_id = w.id AND p.deleted_at IS NULL) AS projects,
         w.created_at, w.archived_at
       FROM workspaces w LEFT JOIN users o ON o.id = w.owner_id
       ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
       ORDER BY w.is_personal, w.created_at DESC LIMIT 200`,
      params,
    );
    return rows.map((r) => ({
      id: r.id, name: r.name, plan: r.plan, isPersonal: r.is_personal,
      owner: r.owner_id && r.owner_name ? { id: r.owner_id, name: r.owner_name, email: r.owner_email ?? "" } : null,
      memberCount: r.members, projectCount: r.projects, createdAt: toISO(r.created_at), archivedAt: iso(r.archived_at),
    }));
  },

  /** Atribuição manual de plano (enquanto não há checkout). Fica na auditoria com o motivo. */
  async setPlan(adminId: string, workspaceId: string, plan: PlanId, reason: string, ip: string | null) {
    const { rows } = await db.query<{ plan: PlanId; owner_id: string; name: string }>(`SELECT plan, owner_id, name FROM workspaces WHERE id = $1`, [workspaceId]);
    if (!rows[0]) throw new NotFoundError("Workspace");
    if (rows[0].plan === plan) return;
    await db.query(`UPDATE workspaces SET plan = $2, updated_at = now() WHERE id = $1`, [workspaceId, plan]);
    await audit({ actorId: adminId, workspaceId, action: "admin.plan_changed", target: workspaceId, ip, data: { from: rows[0].plan, to: plan, reason } });
    await notificationService.notify({
      userIds: [rows[0].owner_id], workspaceId, type: "plan.changed", category: "system",
      title: `${rows[0].name} agora está no plano ${PLANS[plan].name}`, link: `/app/w/${workspaceId}/planos`,
      dedupeKey: `plan:${workspaceId}:${plan}:${Date.now()}`,
    });
  },

  async auditLog(q: { action?: string; cursor?: string }): Promise<{ items: AdminAuditEntry[]; nextCursor: string | null }> {
    const params: unknown[] = [];
    const where: string[] = [];
    if (q.action) {
      params.push(`${q.action.replace(/[%_\\]/g, "\\$&")}%`);
      where.push(`a.action LIKE $${params.length}`);
    }
    if (q.cursor && /^\d+$/.test(q.cursor)) {
      params.push(q.cursor);
      where.push(`a.id < $${params.length}::bigint`);
    }
    const { rows } = await db.query<{
      id: string; actor_id: string | null; actor_name: string | null; action: string; target: string | null;
      workspace_id: string | null; ip: string | null; data: Record<string, unknown> | string; created_at: Date | string;
    }>(
      `SELECT a.id::text AS id, a.actor_id, u.name AS actor_name, a.action, a.target, a.workspace_id, a.ip, a.data, a.created_at
       FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id
       ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY a.id DESC LIMIT 101`,
      params,
    );
    const items = rows.slice(0, 100).map((r) => ({
      id: r.id, actor: r.actor_id && r.actor_name ? { id: r.actor_id, name: r.actor_name } : null, action: r.action, target: r.target,
      workspaceId: r.workspace_id, ip: r.ip, data: typeof r.data === "string" ? (JSON.parse(r.data) as Record<string, unknown>) : r.data,
      createdAt: toISO(r.created_at),
    }));
    return { items, nextCursor: rows.length > 100 ? items[items.length - 1].id : null };
  },

  async status(): Promise<ServiceStatus> {
    const started = Date.now();
    await db.query("SELECT 1");
    const latency = Date.now() - started;
    const [jobs, failed, deliveries] = await Promise.all([
      queueStats(),
      db.query<{ type: string; count: number; last_error: string | null }>(
        `SELECT type, count(*)::int AS count, (array_agg(last_error ORDER BY finished_at DESC))[1] AS last_error
         FROM jobs WHERE status = 'failed' AND finished_at > now() - interval '24 hours' GROUP BY type ORDER BY count DESC`,
      ),
      db.query<{ key: string; count: number }>(
        `SELECT channel || ':' || status AS key, count(*)::int AS count FROM delivery_logs WHERE created_at > now() - interval '24 hours' GROUP BY 1`,
      ),
    ]);
    return {
      database: { ok: true, latencyMs: latency },
      jobs,
      failedJobs24h: failed.rows.map((r) => ({ type: r.type, count: r.count, lastError: r.last_error })),
      deliveries24h: Object.fromEntries(deliveries.rows.map((r) => [r.key, r.count])),
      realtimeConnections: connectedCount(),
      integrations: integrations.toJSON(),
      uptimeSeconds: Math.round(process.uptime()),
    };
  },

  // ------------------------------------------------------------ avisos globais
  async announcements(onlyActive: boolean): Promise<Announcement[]> {
    const { rows } = await db.query<{ id: string; title: string; body: string; level: Announcement["level"]; starts_at: Date | string; ends_at: Date | string | null; created_at: Date | string }>(
      `SELECT id, title, body, level, starts_at, ends_at, created_at FROM announcements
       ${onlyActive ? "WHERE starts_at <= now() AND (ends_at IS NULL OR ends_at > now())" : ""}
       ORDER BY created_at DESC LIMIT ${onlyActive ? 5 : 100}`,
    );
    return rows.map((r) => ({ id: r.id, title: r.title, body: r.body, level: r.level, startsAt: toISO(r.starts_at), endsAt: iso(r.ends_at), createdAt: toISO(r.created_at) }));
  },

  async createAnnouncement(
    adminId: string,
    input: { title: string; body: string; level: Announcement["level"]; startsAt?: string; endsAt?: string | null; notify: boolean },
    ip: string | null,
  ): Promise<Announcement> {
    const { rows } = await db.query<{ id: string }>(
      `INSERT INTO announcements (title, body, level, starts_at, ends_at, created_by) VALUES ($1, $2, $3, COALESCE($4::timestamptz, now()), $5, $6) RETURNING id`,
      [input.title, input.body, input.level, input.startsAt ?? null, input.endsAt ?? null, adminId],
    );
    await audit({ actorId: adminId, action: "admin.announcement_created", target: rows[0].id, ip, data: { title: input.title, notify: input.notify } });
    // Envio em lote pela fila (não trava a requisição, com retry).
    if (input.notify) await enqueue("announcement.broadcast", { announcementId: rows[0].id, title: input.title, body: input.body }, { dedupeKey: `announcement:${rows[0].id}` });
    return (await this.announcements(false)).find((a) => a.id === rows[0].id)!;
  },

  async endAnnouncement(adminId: string, id: string, ip: string | null) {
    const { rows } = await db.query(`UPDATE announcements SET ends_at = now() WHERE id = $1 AND (ends_at IS NULL OR ends_at > now()) RETURNING id`, [id]);
    if (!rows[0]) throw new NotFoundError("Aviso ativo");
    await audit({ actorId: adminId, action: "admin.announcement_ended", target: id, ip });
  },

  // ------------------------------------------------------------ contato da landing
  async contacts(): Promise<Array<{ id: string; name: string; email: string; subject: string; message: string; handledAt: string | null; createdAt: string }>> {
    const { rows } = await db.query<{ id: string; name: string; email: string; subject: string; message: string; handled_at: Date | string | null; created_at: Date | string }>(
      `SELECT id, name, email, subject, message, handled_at, created_at FROM contact_messages ORDER BY handled_at NULLS FIRST, created_at DESC LIMIT 200`,
    );
    return rows.map((r) => ({ id: r.id, name: r.name, email: r.email, subject: r.subject, message: r.message, handledAt: iso(r.handled_at), createdAt: toISO(r.created_at) }));
  },

  async setContactHandled(adminId: string, id: string, handled: boolean, ip: string | null) {
    const { rows } = await db.query(`UPDATE contact_messages SET handled_at = CASE WHEN $2 THEN now() END WHERE id = $1 RETURNING id`, [id, handled]);
    if (!rows[0]) throw new NotFoundError("Mensagem");
    await audit({ actorId: adminId, action: "admin.contact_handled", target: id, ip, data: { handled } });
  },
};

/** Aviso administrativo para todos os usuários ativos, em lotes (evento “aviso administrativo” de R10). */
registerJob("announcement.broadcast", async (payload) => {
  const p = payload as { announcementId: string; title: string; body: string };
  let cursor = "00000000-0000-0000-0000-000000000000";
  for (;;) {
    const { rows } = await db.query<{ id: string }>(
      `SELECT id FROM users WHERE deleted_at IS NULL AND suspended_at IS NULL AND id > $1 ORDER BY id LIMIT 200`,
      [cursor],
    );
    if (!rows.length) break;
    await notificationService.notify({
      userIds: rows.map((r) => r.id), workspaceId: null, type: "admin.announcement", category: "system",
      title: p.title, body: p.body || null, link: null, dedupeKey: `announcement:${p.announcementId}`,
    });
    cursor = rows[rows.length - 1].id;
  }
});
