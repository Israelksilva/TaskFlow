import {
  NOTIFICATION_CATEGORIES,
  type AppNotification,
  type NotificationCategory,
  type NotificationPreferences,
  type NotificationPreferencesInput,
  type Page,
  type PushSubscriptionInput,
} from "@andamo/shared";
import { db, type Queryable } from "../../db";
import { enqueue } from "../../jobs/queue";
import { registerJob } from "../../jobs/worker";
import { sendPush } from "../../lib/push";
import { publishToUser } from "../../realtime/hub";
import { toISO } from "../../shared/dates";
import { NotFoundError } from "../../shared/errors";
import { logDelivery, queueEmail } from "../email/email.service";
import { emailTemplates } from "../email/templates";

export interface NotifyInput {
  userIds: string[];
  workspaceId: string | null;
  type: string;
  category: "tasks" | "comments" | "mentions" | "reminders" | "workspace" | "system";
  title: string;
  body?: string | null;
  link?: string | null;
  entityType?: string;
  entityId?: string;
  projectId?: string | null;
  actorId?: string | null;
  /** Chave de idempotência do evento (por usuário). */
  dedupeKey: string;
}

/** Tipos importantes que também geram e-mail imediato (controle de frequência). */
const EMAIL_TYPES = new Set(["task.assigned", "mention", "task.reminder", "task.overdue", "invitation.received", "admin.announcement", "support.reply", "support.status"]);

interface PrefsRow {
  in_app: boolean;
  push: boolean;
  email: boolean;
  sound: boolean;
  muted_categories: string[];
  muted_projects: string[];
  quiet_start: string | null;
  quiet_end: string | null;
  dnd_until: Date | string | null;
  email_digest: NotificationPreferences["emailDigest"];
  reminder_offsets: number[];
}

const DEFAULT_PREFS: PrefsRow = {
  in_app: true,
  push: true,
  email: true,
  sound: false,
  muted_categories: [],
  muted_projects: [],
  quiet_start: null,
  quiet_end: null,
  dnd_until: null,
  email_digest: "instant",
  reminder_offsets: [1440, 60, 0],
};

const hhmm = (t: string | null) => (t ? t.slice(0, 5) : null);

function toPrefsDTO(r: PrefsRow): NotificationPreferences {
  return {
    inApp: r.in_app,
    push: r.push,
    email: r.email,
    sound: r.sound,
    mutedCategories: r.muted_categories.filter((c): c is NotificationCategory => (NOTIFICATION_CATEGORIES as readonly string[]).includes(c)),
    mutedProjects: r.muted_projects,
    quietStart: hhmm(r.quiet_start),
    quietEnd: hhmm(r.quiet_end),
    dndUntil: r.dnd_until ? toISO(r.dnd_until) : null,
    emailDigest: r.email_digest,
    reminderOffsets: r.reminder_offsets,
  };
}

async function loadPrefs(userIds: string[], tx: Queryable = db): Promise<Map<string, PrefsRow & { timezone: string; email_addr: string; name: string }>> {
  const { rows } = await tx.query<PrefsRow & { user_id: string; timezone: string; email_addr: string; name: string }>(
    `SELECT u.id AS user_id, u.timezone, u.email AS email_addr, u.name,
       COALESCE(p.in_app, true) AS in_app, COALESCE(p.push, true) AS push, COALESCE(p.email, true) AS email,
       COALESCE(p.sound, false) AS sound, COALESCE(p.muted_categories, '{}') AS muted_categories,
       COALESCE(p.muted_projects, '{}') AS muted_projects, p.quiet_start::text AS quiet_start, p.quiet_end::text AS quiet_end,
       p.dnd_until, COALESCE(p.email_digest, 'instant') AS email_digest, COALESCE(p.reminder_offsets, '{1440,60,0}') AS reminder_offsets
     FROM users u LEFT JOIN notification_preferences p ON p.user_id = u.id
     WHERE u.id = ANY($1::uuid[]) AND u.deleted_at IS NULL`,
    [userIds],
  );
  return new Map(rows.map((r) => [r.user_id, r]));
}

/** Horário silencioso / não perturbe: pausa push e e-mail imediato (a central continua registrando). */
export function isQuiet(prefs: Pick<PrefsRow, "quiet_start" | "quiet_end" | "dnd_until">, timezone: string, now = new Date()): boolean {
  if (prefs.dnd_until && new Date(prefs.dnd_until) > now) return true;
  const start = hhmm(prefs.quiet_start);
  const end = hhmm(prefs.quiet_end);
  if (!start || !end || start === end) return false;
  let local: string;
  try {
    local = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(now);
  } catch {
    local = now.toISOString().slice(11, 16);
  }
  return start < end ? local >= start && local < end : local >= start || local < end;
}

interface NotificationRow {
  id: string;
  workspace_id: string | null;
  type: string;
  category: string;
  title: string;
  body: string | null;
  link: string | null;
  entity_type: string | null;
  entity_id: string | null;
  actor_id: string | null;
  actor_name: string | null;
  actor_avatar: string | null;
  read_at: Date | string | null;
  created_at: Date | string;
}

const toDTO = (r: NotificationRow): AppNotification => ({
  id: r.id,
  workspaceId: r.workspace_id,
  type: r.type,
  category: r.category,
  title: r.title,
  body: r.body,
  link: r.link,
  entityType: r.entity_type,
  entityId: r.entity_id,
  actor: r.actor_id && r.actor_name ? { id: r.actor_id, name: r.actor_name, avatarUrl: r.actor_avatar } : null,
  readAt: r.read_at ? toISO(r.read_at) : null,
  createdAt: toISO(r.created_at),
});

const SELECT = `SELECT n.id, n.workspace_id, n.type, n.category, n.title, n.body, n.link, n.entity_type, n.entity_id,
  n.actor_id, a.name AS actor_name, a.avatar_url AS actor_avatar, n.read_at, n.created_at
  FROM notifications n LEFT JOIN users a ON a.id = n.actor_id`;

export const notificationService = {
  /**
   * Cria notificações respeitando preferências e idempotência (`dedupeKey`), publica em
   * tempo real e agenda push/e-mail pela fila. O autor da ação nunca é notificado.
   */
  async notify(input: NotifyInput): Promise<number> {
    const recipients = [...new Set(input.userIds)].filter((id) => id && id !== input.actorId);
    if (!recipients.length) return 0;
    const prefs = await loadPrefs(recipients);
    let created = 0;

    for (const userId of recipients) {
      const p = prefs.get(userId);
      if (!p) continue;
      if (p.muted_categories.includes(input.category) && input.category !== "system") continue;
      if (input.projectId && p.muted_projects.includes(input.projectId)) continue;

      let notificationId: string | null = null;
      if (p.in_app) {
        const { rows } = await db.query<NotificationRow>(
          `WITH ins AS (
             INSERT INTO notifications (user_id, workspace_id, type, category, title, body, link, entity_type, entity_id, actor_id, dedupe_key)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             ON CONFLICT (user_id, dedupe_key) DO NOTHING
             RETURNING *
           )
           SELECT ins.id, ins.workspace_id, ins.type, ins.category, ins.title, ins.body, ins.link, ins.entity_type, ins.entity_id,
             ins.actor_id, a.name AS actor_name, a.avatar_url AS actor_avatar, ins.read_at, ins.created_at
           FROM ins LEFT JOIN users a ON a.id = ins.actor_id`,
          [
            userId, input.workspaceId, input.type, input.category, input.title.slice(0, 200),
            input.body?.slice(0, 500) ?? null, input.link ?? null, input.entityType ?? null,
            input.entityId ?? null, input.actorId ?? null, input.dedupeKey,
          ],
        );
        if (!rows[0]) continue; // duplicado: evento já notificado
        notificationId = rows[0].id;
        created += 1;
        publishToUser(userId, { type: "notification", notification: toDTO(rows[0]), sound: p.sound });
      }

      const wantsPush = p.push;
      const wantsEmail = p.email && p.email_digest === "instant" && EMAIL_TYPES.has(input.type);
      if (wantsPush || wantsEmail) {
        await enqueue(
          "notification.deliver",
          {
            userId, notificationId, type: input.type, title: input.title, body: input.body ?? null,
            link: input.link ?? null, push: wantsPush, email: wantsEmail,
          },
          { dedupeKey: `deliver:${userId}:${input.dedupeKey}`.slice(0, 200), maxAttempts: 4 },
        );
      }
    }
    return created;
  },

  async list(userId: string, q: { filter: "all" | "unread"; category?: string; cursor?: string; limit: number }): Promise<Page<AppNotification>> {
    const params: unknown[] = [userId];
    const where = ["n.user_id = $1"];
    if (q.filter === "unread") where.push("n.read_at IS NULL");
    if (q.category) {
      params.push(q.category);
      where.push(`n.category = $${params.length}`);
    }
    if (q.cursor) {
      const [ts, id] = q.cursor.split("|");
      if (ts && id && !Number.isNaN(Date.parse(ts))) {
        params.push(ts, id);
        where.push(`(n.created_at, n.id) < ($${params.length - 1}::timestamptz, $${params.length}::uuid)`);
      }
    }
    params.push(q.limit + 1);
    const { rows } = await db.query<NotificationRow>(
      `${SELECT} WHERE ${where.join(" AND ")} ORDER BY n.created_at DESC, n.id DESC LIMIT $${params.length}`,
      params,
    );
    const items = rows.slice(0, q.limit).map(toDTO);
    const last = items[items.length - 1];
    return { items, nextCursor: rows.length > q.limit && last ? `${last.createdAt}|${last.id}` : null };
  },

  async unreadCount(userId: string): Promise<number> {
    const { rows } = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM notifications WHERE user_id = $1 AND read_at IS NULL`,
      [userId],
    );
    return rows[0].n;
  },

  async markRead(userId: string, id: string, read = true): Promise<void> {
    const { rows } = await db.query(
      `UPDATE notifications SET read_at = CASE WHEN $3 THEN COALESCE(read_at, now()) END WHERE id = $1 AND user_id = $2 RETURNING id`,
      [id, userId, read],
    );
    if (!rows.length) throw new NotFoundError("Notificação");
    publishToUser(userId, { type: "notification.read", ids: [id], read });
  },

  async markAllRead(userId: string): Promise<number> {
    const { rows } = await db.query(
      `UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL RETURNING id`,
      [userId],
    );
    publishToUser(userId, { type: "notification.read", all: true, read: true });
    return rows.length;
  },

  async remove(userId: string, id: string): Promise<void> {
    const { rows } = await db.query(`DELETE FROM notifications WHERE id = $1 AND user_id = $2 RETURNING id`, [id, userId]);
    if (!rows.length) throw new NotFoundError("Notificação");
  },

  async getPreferences(userId: string): Promise<NotificationPreferences> {
    const { rows } = await db.query<PrefsRow>(
      `SELECT in_app, push, email, sound, muted_categories, muted_projects, quiet_start::text AS quiet_start,
         quiet_end::text AS quiet_end, dnd_until, email_digest, reminder_offsets
       FROM notification_preferences WHERE user_id = $1`,
      [userId],
    );
    return toPrefsDTO(rows[0] ?? DEFAULT_PREFS);
  },

  async updatePreferences(userId: string, input: NotificationPreferencesInput): Promise<NotificationPreferences> {
    const current = await this.getPreferences(userId);
    const next = { ...current, ...input };
    await db.query(
      `INSERT INTO notification_preferences (user_id, in_app, push, email, sound, muted_categories, muted_projects,
         quiet_start, quiet_end, dnd_until, email_digest, reminder_offsets, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now())
       ON CONFLICT (user_id) DO UPDATE SET in_app = $2, push = $3, email = $4, sound = $5, muted_categories = $6,
         muted_projects = $7, quiet_start = $8, quiet_end = $9, dnd_until = $10, email_digest = $11,
         reminder_offsets = $12, updated_at = now()`,
      [
        userId, next.inApp, next.push, next.email, next.sound, next.mutedCategories, next.mutedProjects,
        next.quietStart, next.quietEnd, next.dndUntil, next.emailDigest, [...new Set(next.reminderOffsets)],
      ],
    );
    return this.getPreferences(userId);
  },

  async subscribePush(userId: string, sub: PushSubscriptionInput, userAgent: string | null): Promise<void> {
    // Um endpoint pertence a um navegador: se outro usuário logar nele, a inscrição muda de dono.
    await db.query(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (endpoint) DO UPDATE SET user_id = $1, p256dh = $3, auth = $4, user_agent = $5, failure_count = 0`,
      [userId, sub.endpoint, sub.keys.p256dh, sub.keys.auth, userAgent],
    );
  },

  async unsubscribePush(userId: string, endpoint: string): Promise<void> {
    await db.query(`DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2`, [userId, endpoint]);
  },

  loadPrefs,
};

// ---------------------------------------------------------------- entrega (fila)
registerJob("notification.deliver", async (payload) => {
  const p = payload as {
    userId: string; notificationId: string | null; type: string; title: string; body: string | null;
    link: string | null; push: boolean; email: boolean;
  };
  const prefs = (await loadPrefs([p.userId])).get(p.userId);
  if (!prefs) return;
  const log = (channel: "push" | "email", status: "sent" | "failed" | "skipped", detail: string | null) =>
    logDelivery(p.notificationId, p.userId, channel, status, detail);

  if (isQuiet(prefs, prefs.timezone)) {
    if (p.push) await log("push", "skipped", "Horário silencioso / não perturbe");
    if (p.email) await log("email", "skipped", "Horário silencioso / não perturbe");
    return;
  }

  if (p.push) {
    // Controle de frequência: no máximo 20 pushes por usuário em 10 minutos.
    const { rows: recent } = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM delivery_logs WHERE user_id = $1 AND channel = 'push' AND status = 'sent'
         AND created_at > now() - interval '10 minutes'`,
      [p.userId],
    );
    const { rows: subs } = await db.query<{ id: string; endpoint: string; p256dh: string; auth: string }>(
      `SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1`,
      [p.userId],
    );
    if (recent[0].n >= 20) await log("push", "skipped", "Limite de frequência");
    else {
      let failed = 0;
      for (const s of subs) {
        const outcome = await sendPush(s, { title: p.title, body: p.body ?? "", url: p.link ?? "/app/notificacoes", tag: p.notificationId ?? p.type });
        if (outcome === "expired") await db.query(`DELETE FROM push_subscriptions WHERE id = $1`, [s.id]);
        else if (outcome === "sent") await db.query(`UPDATE push_subscriptions SET last_success_at = now(), failure_count = 0 WHERE id = $1`, [s.id]);
        else if (outcome === "failed") {
          failed += 1;
          // Inscrições que falham repetidamente são descartadas.
          await db.query(`UPDATE push_subscriptions SET failure_count = failure_count + 1 WHERE id = $1`, [s.id]);
          await db.query(`DELETE FROM push_subscriptions WHERE id = $1 AND failure_count >= 10`, [s.id]);
        }
        await log("push", outcome === "sent" ? "sent" : outcome === "disabled" ? "skipped" : "failed", outcome === "disabled" ? "VAPID não configurado" : outcome);
      }
      if (failed && failed === subs.length) throw new Error("Falha ao entregar push em todas as inscrições");
    }
  }

  if (p.email) {
    await queueEmail(prefs.email_addr, emailTemplates.notification(p.title, p.body, p.link), {
      userId: p.userId,
      notificationId: p.notificationId ?? undefined,
      // Retry do job não duplica o e-mail.
      dedupeKey: p.notificationId ? `email:notification:${p.notificationId}` : undefined,
    });
  }
});
