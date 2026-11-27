import type { SessionInfo } from "@andamo/shared";
import { db as defaultDb, type Queryable } from "../../db";
import { toISO } from "../../shared/dates";

export interface SessionRow {
  id: string;
  user_id: string;
  remember: boolean;
  user_agent: string | null;
  ip: string | null;
  created_at: Date | string;
  last_used_at: Date | string;
  expires_at: Date | string;
  revoked_at: Date | string | null;
  rotated_at: Date | string | null;
}

const COLUMNS = "id, user_id, remember, user_agent, ip, created_at, last_used_at, expires_at, revoked_at, rotated_at";

export const toSessionDTO = (row: SessionRow, currentId?: string): SessionInfo => ({
  id: row.id,
  current: row.id === currentId,
  userAgent: row.user_agent,
  ip: row.ip,
  createdAt: toISO(row.created_at),
  lastUsedAt: toISO(row.last_used_at),
  expiresAt: toISO(row.expires_at),
});

export const sessionRepository = {
  async create(
    data: { userId: string; tokenHash: string; remember: boolean; expiresAt: Date; userAgent: string | null; ip: string | null },
    db: Queryable = defaultDb,
  ): Promise<SessionRow> {
    const { rows } = await db.query<SessionRow>(
      `INSERT INTO sessions (user_id, token_hash, remember, expires_at, user_agent, ip)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING ${COLUMNS}`,
      [data.userId, data.tokenHash, data.remember, data.expiresAt.toISOString(), data.userAgent, data.ip],
    );
    return rows[0];
  },

  /** Troca o refresh token de forma atômica: só um pedido concorrente vence. */
  async rotate(
    oldHash: string,
    data: { newHash: string; userAgent: string | null; ip: string | null },
    db: Queryable = defaultDb,
  ): Promise<SessionRow | null> {
    const { rows } = await db.query<SessionRow>(
      `UPDATE sessions
          SET token_hash = $2, previous_hash = token_hash, rotated_at = now(), last_used_at = now(),
              -- "Manter conectado" desliza 30 dias a cada uso; a sessão curta mantém o prazo.
              expires_at = CASE WHEN remember THEN now() + interval '30 days' ELSE expires_at END,
              user_agent = COALESCE($3, user_agent), ip = COALESCE($4, ip)
        WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > now()
        RETURNING ${COLUMNS}`,
      [oldHash, data.newHash, data.userAgent, data.ip],
    );
    return rows[0] ?? null;
  },

  async findByPreviousHash(hash: string, db: Queryable = defaultDb): Promise<SessionRow | null> {
    const { rows } = await db.query<SessionRow>(`SELECT ${COLUMNS} FROM sessions WHERE previous_hash = $1`, [hash]);
    return rows[0] ?? null;
  },

  async isActive(id: string, userId: string, db: Queryable = defaultDb): Promise<boolean> {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return false;
    const { rows } = await db.query(
      "SELECT 1 FROM sessions WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL AND expires_at > now()",
      [id, userId],
    );
    return rows.length > 0;
  },

  async listActive(userId: string, db: Queryable = defaultDb): Promise<SessionRow[]> {
    const { rows } = await db.query<SessionRow>(
      `SELECT ${COLUMNS} FROM sessions WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > now()
       ORDER BY last_used_at DESC`,
      [userId],
    );
    return rows;
  },

  async revoke(userId: string, id: string, reason: string, db: Queryable = defaultDb): Promise<boolean> {
    const { rows } = await db.query(
      `UPDATE sessions SET revoked_at = now(), revoked_reason = $3
        WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL RETURNING id`,
      [id, userId, reason],
    );
    return rows.length > 0;
  },

  /** Encerra todas as sessões do usuário, exceto (opcionalmente) a atual. Retorna quantas. */
  async revokeAll(userId: string, reason: string, exceptId: string | null = null, db: Queryable = defaultDb) {
    const { rows } = await db.query(
      `UPDATE sessions SET revoked_at = now(), revoked_reason = $2
        WHERE user_id = $1 AND revoked_at IS NULL AND ($3::uuid IS NULL OR id <> $3::uuid) RETURNING id`,
      [userId, reason, exceptId],
    );
    return rows.length;
  },
};
