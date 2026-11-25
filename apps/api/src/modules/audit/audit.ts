import { db as defaultDb, type Queryable } from "../../db";
import { logger } from "../../lib/logger";

/** Registra ações sensíveis (segurança, permissões, administração). Nunca derruba a requisição. */
export async function audit(
  entry: { actorId: string | null; action: string; workspaceId?: string | null; target?: string; ip?: string | null; data?: Record<string, unknown> },
  db: Queryable = defaultDb,
): Promise<void> {
  try {
    await db.query(
      `INSERT INTO audit_log (actor_id, workspace_id, action, target, ip, data) VALUES ($1, $2, $3, $4, $5, $6)`,
      [entry.actorId, entry.workspaceId ?? null, entry.action, entry.target ?? null, entry.ip ?? null, JSON.stringify(entry.data ?? {})],
    );
  } catch (error) {
    logger.warn({ err: error, action: entry.action }, "Falha ao registrar auditoria");
  }
}
