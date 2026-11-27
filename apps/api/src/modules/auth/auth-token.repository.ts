import { db as defaultDb, type Queryable } from "../../db";
import { randomToken, sha256 } from "../../lib/crypto";

export type TokenPurpose = "verify_email" | "reset_password" | "mfa_challenge" | "oauth_state" | "oauth_exchange";

export interface TokenRecord<P = Record<string, unknown>> {
  id: string;
  userId: string | null;
  payload: P;
}

/** Tokens de uso único: o valor só existe com o usuário; aqui fica o SHA-256. */
export const authTokens = {
  async issue(
    purpose: TokenPurpose,
    ttlMs: number,
    { userId = null, payload = {} }: { userId?: string | null; payload?: Record<string, unknown> } = {},
    db: Queryable = defaultDb,
  ): Promise<string> {
    const token = randomToken();
    await db.query(
      `INSERT INTO auth_tokens (user_id, purpose, token_hash, payload, expires_at) VALUES ($1, $2, $3, $4, $5)`,
      [userId, purpose, sha256(token), JSON.stringify(payload), new Date(Date.now() + ttlMs).toISOString()],
    );
    return token;
  },

  /** Marca como usado e devolve o registro — atômico: dois usos simultâneos, só um vence. */
  async consume<P = Record<string, unknown>>(
    token: string,
    purpose: TokenPurpose,
    db: Queryable = defaultDb,
  ): Promise<TokenRecord<P> | null> {
    const { rows } = await db.query<{ id: string; user_id: string | null; payload: P | string }>(
      `UPDATE auth_tokens SET used_at = now()
        WHERE token_hash = $1 AND purpose = $2 AND used_at IS NULL AND expires_at > now()
        RETURNING id, user_id, payload`,
      [sha256(token), purpose],
    );
    const row = rows[0];
    if (!row) return null;
    return { id: row.id, userId: row.user_id, payload: (typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload) as P };
  },

  /** Lê sem consumir (desafio de 2FA aceita algumas tentativas). */
  async peek<P = Record<string, unknown>>(token: string, purpose: TokenPurpose, db: Queryable = defaultDb) {
    const { rows } = await db.query<{ id: string; user_id: string | null; payload: P | string }>(
      `SELECT id, user_id, payload FROM auth_tokens
        WHERE token_hash = $1 AND purpose = $2 AND used_at IS NULL AND expires_at > now()`,
      [sha256(token), purpose],
    );
    const row = rows[0];
    if (!row) return null;
    return { id: row.id, userId: row.user_id, payload: (typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload) as P };
  },

  async updatePayload(id: string, payload: Record<string, unknown>, db: Queryable = defaultDb) {
    await db.query("UPDATE auth_tokens SET payload = $2 WHERE id = $1", [id, JSON.stringify(payload)]);
  },

  async markUsed(id: string, db: Queryable = defaultDb) {
    await db.query("UPDATE auth_tokens SET used_at = now() WHERE id = $1 AND used_at IS NULL", [id]);
  },

  /** Invalida tokens anteriores do mesmo tipo (ex.: só o último link de redefinição vale). */
  async revokeAll(userId: string, purpose: TokenPurpose, db: Queryable = defaultDb) {
    await db.query("UPDATE auth_tokens SET used_at = now() WHERE user_id = $1 AND purpose = $2 AND used_at IS NULL", [
      userId,
      purpose,
    ]);
  },
};
