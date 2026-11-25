import type { Activity, Page } from "@andamo/shared";
import { db as defaultDb, type Queryable } from "../../db";
import { toISO } from "../../shared/dates";

export interface ActivityEntry {
  workspaceId: string;
  actorId: string | null;
  entityType: "task" | "project" | "workspace" | "member" | "comment" | "team";
  entityId: string;
  projectId?: string | null;
  action: string;
  data?: Record<string, unknown>;
}

interface ActivityRow {
  id: string;
  actor_id: string | null;
  actor_name: string | null;
  actor_avatar: string | null;
  entity_type: string;
  entity_id: string;
  project_id: string | null;
  action: string;
  data: Record<string, unknown> | string;
  created_at: Date | string;
}

export const activityRepository = {
  async log(entry: ActivityEntry, db: Queryable = defaultDb): Promise<void> {
    await db.query(
      `INSERT INTO activity_log (workspace_id, actor_id, entity_type, entity_id, project_id, action, data)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [entry.workspaceId, entry.actorId, entry.entityType, entry.entityId, entry.projectId ?? null, entry.action, JSON.stringify(entry.data ?? {})],
    );
  },

  async list(
    workspaceId: string,
    filter: { entityType?: string; entityId?: string; projectId?: string; cursor?: string; limit?: number },
    db: Queryable = defaultDb,
  ): Promise<Page<Activity>> {
    const params: unknown[] = [workspaceId];
    const where = ["l.workspace_id = $1"];
    const add = (sql: string, value: unknown) => {
      params.push(value);
      where.push(sql.replace("?", `$${params.length}`));
    };
    if (filter.entityType) add("l.entity_type = ?", filter.entityType);
    if (filter.entityId) add("l.entity_id = ?", filter.entityId);
    if (filter.projectId) add("l.project_id = ?", filter.projectId);
    if (filter.cursor && /^\d+$/.test(filter.cursor)) add("l.id < ?::bigint", filter.cursor);
    const limit = Math.min(filter.limit ?? 30, 100);
    params.push(limit + 1);

    const { rows } = await db.query<ActivityRow>(
      `SELECT l.id::text AS id, l.actor_id, u.name AS actor_name, u.avatar_url AS actor_avatar, l.entity_type, l.entity_id,
         l.project_id, l.action, l.data, l.created_at
       FROM activity_log l LEFT JOIN users u ON u.id = l.actor_id
       WHERE ${where.join(" AND ")} ORDER BY l.id DESC LIMIT $${params.length}`,
      params,
    );
    const items = rows.slice(0, limit).map((r) => ({
      id: r.id,
      actor: r.actor_id && r.actor_name ? { id: r.actor_id, name: r.actor_name, avatarUrl: r.actor_avatar } : null,
      entityType: r.entity_type,
      entityId: r.entity_id,
      projectId: r.project_id,
      action: r.action,
      data: typeof r.data === "string" ? (JSON.parse(r.data) as Record<string, unknown>) : r.data,
      createdAt: toISO(r.created_at),
    }));
    return { items, nextCursor: rows.length > limit ? items[items.length - 1].id : null };
  },
};
