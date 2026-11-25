import type { Session } from "@andamo/shared";
import { env } from "../../config/env";
import { db as defaultDb, type Queryable } from "../../db";
import { randomToken, sha256 } from "../../lib/crypto";
import { accessTokenTtlSeconds, signAccessToken } from "../../lib/token";
import { toISO } from "../../shared/dates";
import { UnauthorizedError } from "../../shared/errors";

interface SessionRow {
  id: string;
  user_id: string;
  user_agent: string | null;
  ip: string | null;
  created_at: Date | string;
  last_used_at: Date | string;
  expires_at: Date | string;
  revoked_at: Date | string | null;
}

export interface IssuedTokens {
  token: string;
  refreshToken: string;
  expiresIn: number;
  sessionId: string;
}

const ttlDays = () => env.REFRESH_TOKEN_TTL_DAYS;

export const sessionService = {
  /** Abre uma sessão (um dispositivo) e devolve access + refresh token. */
  async create(
    userId: string,
    client: { ip: string | null; userAgent: string | null },
    db: Queryable = defaultDb,
  ): Promise<IssuedTokens> {
    const refreshToken = randomToken(48);
    const { rows } = await db.query<{ id: string }>(
      `INSERT INTO sessions (user_id, refresh_token_hash, user_agent, ip, expires_at)
       VALUES ($1, $2, $3, $4, now() + make_interval(days => $5)) RETURNING id`,
      [userId, sha256(refreshToken), client.userAgent, client.ip, ttlDays()],
    );
    const sessionId = rows[0].id;
    return { token: signAccessToken(userId, sessionId), refreshToken, expiresIn: accessTokenTtlSeconds(), sessionId };
  },

  /**
   * Rotação: cada refresh token só vale uma vez. Se um token já rotacionado for
   * reapresentado (provável roubo), a sessão inteira é revogada.
   */
  async refresh(refreshToken: string, client: { ip: string | null }, db: Queryable = defaultDb) {
    const hash = sha256(refreshToken);
    const { rows } = await db.query<SessionRow>(
      `SELECT id, user_id, revoked_at, expires_at FROM sessions WHERE refresh_token_hash = $1`,
      [hash],
    );
    const session = rows[0];

    if (!session) {
      const reused = await db.query<{ id: string }>(
        `UPDATE sessions SET revoked_at = now() WHERE previous_token_hash = $1 AND revoked_at IS NULL RETURNING id`,
        [hash],
      );
      throw new UnauthorizedError(
        reused.rows.length ? "Sessão encerrada por segurança. Faça login novamente." : "Sessão inválida. Faça login novamente.",
        "INVALID_REFRESH_TOKEN",
      );
    }
    if (session.revoked_at || new Date(session.expires_at) <= new Date()) {
      throw new UnauthorizedError("Sessão expirada. Faça login novamente.", "INVALID_REFRESH_TOKEN");
    }

    const next = randomToken(48);
    const updated = await db.query<{ id: string }>(
      `UPDATE sessions SET refresh_token_hash = $2, previous_token_hash = $1, last_used_at = now(), ip = COALESCE($3, ip)
       WHERE id = $4 AND refresh_token_hash = $1 RETURNING id`,
      [hash, sha256(next), client.ip, session.id],
    );
    // Duas renovações simultâneas com o mesmo token: só a primeira vence.
    if (!updated.rows.length) throw new UnauthorizedError("Sessão inválida. Faça login novamente.", "INVALID_REFRESH_TOKEN");

    return {
      userId: session.user_id,
      tokens: { token: signAccessToken(session.user_id, session.id), refreshToken: next, expiresIn: accessTokenTtlSeconds(), sessionId: session.id },
    };
  },

  async list(userId: string, currentSessionId: string, db: Queryable = defaultDb): Promise<Session[]> {
    const { rows } = await db.query<SessionRow>(
      `SELECT id, user_agent, ip, created_at, last_used_at FROM sessions
       WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > now()
       ORDER BY last_used_at DESC`,
      [userId],
    );
    return rows.map((r) => ({
      id: r.id,
      userAgent: r.user_agent,
      ip: r.ip,
      createdAt: toISO(r.created_at),
      lastUsedAt: toISO(r.last_used_at),
      current: r.id === currentSessionId,
    }));
  },

  async revoke(userId: string, sessionId: string, db: Queryable = defaultDb): Promise<boolean> {
    const { rows } = await db.query(
      `UPDATE sessions SET revoked_at = now() WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL RETURNING id`,
      [sessionId, userId],
    );
    return rows.length > 0;
  },

  /** Encerra todas as sessões do usuário, exceto (opcionalmente) a atual. */
  async revokeAll(userId: string, exceptSessionId: string | null, db: Queryable = defaultDb): Promise<number> {
    const { rows } = await db.query(
      `UPDATE sessions SET revoked_at = now()
       WHERE user_id = $1 AND revoked_at IS NULL AND ($2::uuid IS NULL OR id <> $2::uuid) RETURNING id`,
      [userId, exceptSessionId],
    );
    return rows.length;
  },
};
