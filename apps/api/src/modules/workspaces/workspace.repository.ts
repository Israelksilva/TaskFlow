import type { Invitation, Member, PlanId, Role, Team, Workspace } from "@andamo/shared";
import { db as defaultDb, type Queryable } from "../../db";
import { randomToken } from "../../lib/crypto";
import { toISO } from "../../shared/dates";

interface WorkspaceRow {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  plan: PlanId;
  is_personal: boolean;
  owner_id: string;
  role: Role;
  member_count: number;
  archived_at: Date | string | null;
  created_at: Date | string;
}

const toWorkspace = (r: WorkspaceRow): Workspace => ({
  id: r.id,
  name: r.name,
  slug: r.slug,
  logoUrl: r.logo_url,
  plan: r.plan,
  isPersonal: r.is_personal,
  ownerId: r.owner_id,
  role: r.role,
  memberCount: r.member_count,
  archivedAt: r.archived_at ? toISO(r.archived_at) : null,
  createdAt: toISO(r.created_at),
});

const WS_SELECT = `SELECT w.id, w.name, w.slug, w.logo_url, w.plan, w.is_personal, w.owner_id, m.role,
    (SELECT count(*)::int FROM workspace_members x WHERE x.workspace_id = w.id) AS member_count,
    w.archived_at, w.created_at
  FROM workspaces w JOIN workspace_members m ON m.workspace_id = w.id`;

function slugify(name: string): string {
  const base = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `${base || "workspace"}-${randomToken(4).toLowerCase().replace(/[^a-z0-9]/g, "")}`;
}

export interface MembershipRow {
  workspace_id: string;
  role: Role;
  plan: PlanId;
  is_personal: boolean;
  archived_at: Date | string | null;
}

export const workspaceRepository = {
  async listForUser(userId: string, db: Queryable = defaultDb): Promise<Workspace[]> {
    const { rows } = await db.query<WorkspaceRow>(
      `${WS_SELECT} WHERE m.user_id = $1 ORDER BY w.is_personal DESC, w.created_at`,
      [userId],
    );
    return rows.map(toWorkspace);
  },

  async getForUser(workspaceId: string, userId: string, db: Queryable = defaultDb): Promise<Workspace | null> {
    const { rows } = await db.query<WorkspaceRow>(`${WS_SELECT} WHERE w.id = $1 AND m.user_id = $2`, [workspaceId, userId]);
    return rows[0] ? toWorkspace(rows[0]) : null;
  },

  async membership(workspaceId: string, userId: string, db: Queryable = defaultDb): Promise<MembershipRow | null> {
    const { rows } = await db.query<MembershipRow>(
      `SELECT m.workspace_id, m.role, w.plan, w.is_personal, w.archived_at
       FROM workspace_members m JOIN workspaces w ON w.id = m.workspace_id
       WHERE m.workspace_id = $1 AND m.user_id = $2`,
      [workspaceId, userId],
    );
    return rows[0] ?? null;
  },

  /** Cria workspace + vínculo do dono (+ projeto padrão quando pessoal). */
  async create(
    data: { name: string; ownerId: string; personal?: boolean },
    db: Queryable = defaultDb,
  ): Promise<string> {
    const { rows } = await db.query<{ id: string }>(
      `INSERT INTO workspaces (name, slug, owner_id, is_personal) VALUES ($1, $2, $3, $4) RETURNING id`,
      [data.name, slugify(data.name), data.ownerId, data.personal ?? false],
    );
    const id = rows[0].id;
    await db.query(`INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'owner')`, [id, data.ownerId]);
    if (data.personal) {
      await db.query(
        `INSERT INTO projects (workspace_id, name, icon, owner_id, created_by, is_default)
         VALUES ($1, 'Minhas tarefas', 'check-square', $2, $2, true)`,
        [id, data.ownerId],
      );
    }
    return id;
  },

  async createPersonal(userId: string, userName: string, db: Queryable = defaultDb): Promise<string> {
    return this.create({ name: `Espaço de ${userName.trim().split(/\s+/)[0]}`, ownerId: userId, personal: true }, db);
  },

  /** Projeto padrão do workspace pessoal (usado pelas rotas legadas /tarefas). */
  async defaultProject(userId: string, db: Queryable = defaultDb): Promise<{ workspaceId: string; projectId: string } | null> {
    const { rows } = await db.query<{ workspace_id: string; project_id: string }>(
      `SELECT w.id AS workspace_id, p.id AS project_id FROM workspaces w
       JOIN projects p ON p.workspace_id = w.id AND p.is_default AND p.deleted_at IS NULL
       WHERE w.owner_id = $1 AND w.is_personal ORDER BY w.created_at LIMIT 1`,
      [userId],
    );
    return rows[0] ? { workspaceId: rows[0].workspace_id, projectId: rows[0].project_id } : null;
  },

  async update(id: string, data: { name?: string; logoUrl?: string | null }, db: Queryable = defaultDb) {
    await db.query(
      `UPDATE workspaces SET name = COALESCE($2, name),
         logo_url = CASE WHEN $3::boolean THEN $4 ELSE logo_url END, updated_at = now()
       WHERE id = $1`,
      [id, data.name ?? null, data.logoUrl !== undefined, data.logoUrl ?? null],
    );
  },

  async setArchived(id: string, archived: boolean, db: Queryable = defaultDb) {
    await db.query(`UPDATE workspaces SET archived_at = CASE WHEN $2 THEN now() END, updated_at = now() WHERE id = $1`, [id, archived]);
  },

  async transferOwnership(id: string, fromUserId: string, toUserId: string, db: Queryable) {
    await db.query(`UPDATE workspaces SET owner_id = $2, updated_at = now() WHERE id = $1`, [id, toUserId]);
    await db.query(`UPDATE workspace_members SET role = 'owner' WHERE workspace_id = $1 AND user_id = $2`, [id, toUserId]);
    await db.query(`UPDATE workspace_members SET role = 'admin' WHERE workspace_id = $1 AND user_id = $2`, [id, fromUserId]);
  },

  // ------------------------------------------------------------ membros
  async members(workspaceId: string, db: Queryable = defaultDb): Promise<Member[]> {
    const { rows } = await db.query<{
      id: string; name: string; email: string; avatar_url: string | null; role: Role;
      job_title: string | null; department: string | null; capacity_hours: number | null; joined_at: Date | string;
    }>(
      `SELECT u.id, u.name, u.email, u.avatar_url, m.role, m.job_title, m.department, m.capacity_hours, m.joined_at
       FROM workspace_members m JOIN users u ON u.id = m.user_id
       WHERE m.workspace_id = $1 AND u.deleted_at IS NULL
       ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 WHEN 'manager' THEN 2 ELSE 3 END, u.name`,
      [workspaceId],
    );
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      avatarUrl: r.avatar_url,
      role: r.role,
      jobTitle: r.job_title,
      department: r.department,
      capacityHours: r.capacity_hours,
      joinedAt: toISO(r.joined_at),
    }));
  },

  async memberRole(workspaceId: string, userId: string, db: Queryable = defaultDb): Promise<Role | null> {
    const { rows } = await db.query<{ role: Role }>(
      `SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
      [workspaceId, userId],
    );
    return rows[0]?.role ?? null;
  },

  /** Filtra ids que de fato são membros do workspace (impede atribuir a estranhos). */
  async filterMembers(workspaceId: string, userIds: string[], db: Queryable = defaultDb): Promise<string[]> {
    if (!userIds.length) return [];
    const { rows } = await db.query<{ user_id: string }>(
      `SELECT user_id FROM workspace_members WHERE workspace_id = $1 AND user_id = ANY($2::uuid[])`,
      [workspaceId, userIds],
    );
    return rows.map((r) => r.user_id);
  },

  async countMembers(workspaceId: string, db: Queryable = defaultDb): Promise<number> {
    const { rows } = await db.query<{ n: number }>(
      `SELECT (SELECT count(*) FROM workspace_members WHERE workspace_id = $1)
            + (SELECT count(*) FROM workspace_invitations WHERE workspace_id = $1 AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > now())
            AS n`,
      [workspaceId],
    );
    return Number(rows[0].n);
  },

  async addMember(workspaceId: string, userId: string, role: Role, db: Queryable = defaultDb) {
    await db.query(
      `INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, $3)
       ON CONFLICT (workspace_id, user_id) DO NOTHING`,
      [workspaceId, userId, role],
    );
  },

  async updateMember(
    workspaceId: string,
    userId: string,
    data: { role?: Role; jobTitle?: string | null; department?: string | null; capacityHours?: number | null },
    db: Queryable = defaultDb,
  ) {
    await db.query(
      `UPDATE workspace_members SET
         role = COALESCE($3, role),
         job_title = CASE WHEN $4::boolean THEN $5 ELSE job_title END,
         department = CASE WHEN $6::boolean THEN $7 ELSE department END,
         capacity_hours = CASE WHEN $8::boolean THEN $9::smallint ELSE capacity_hours END
       WHERE workspace_id = $1 AND user_id = $2`,
      [
        workspaceId, userId, data.role ?? null,
        data.jobTitle !== undefined, data.jobTitle ?? null,
        data.department !== undefined, data.department ?? null,
        data.capacityHours !== undefined, data.capacityHours ?? null,
      ],
    );
  },

  async removeMember(workspaceId: string, userId: string, db: Queryable = defaultDb) {
    await db.query(`DELETE FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`, [workspaceId, userId]);
    await db.query(
      `DELETE FROM team_members WHERE user_id = $2 AND team_id IN (SELECT id FROM teams WHERE workspace_id = $1)`,
      [workspaceId, userId],
    );
    await db.query(
      `DELETE FROM task_assignees WHERE user_id = $2 AND task_id IN (SELECT id FROM tasks WHERE workspace_id = $1)`,
      [workspaceId, userId],
    );
  },

  // ------------------------------------------------------------ convites
  async invitations(workspaceId: string, db: Queryable = defaultDb): Promise<Invitation[]> {
    const { rows } = await db.query<{
      id: string; email: string; role: Role; inviter: string | null; expires_at: Date | string; created_at: Date | string;
    }>(
      `SELECT i.id, i.email, i.role, u.name AS inviter, i.expires_at, i.created_at
       FROM workspace_invitations i LEFT JOIN users u ON u.id = i.invited_by
       WHERE i.workspace_id = $1 AND i.accepted_at IS NULL AND i.revoked_at IS NULL AND i.expires_at > now()
       ORDER BY i.created_at DESC`,
      [workspaceId],
    );
    return rows.map((r) => ({
      id: r.id,
      email: r.email,
      role: r.role,
      invitedBy: r.inviter,
      expiresAt: toISO(r.expires_at),
      createdAt: toISO(r.created_at),
    }));
  },

  // ------------------------------------------------------------ equipes
  async teams(workspaceId: string, db: Queryable = defaultDb): Promise<Team[]> {
    const { rows } = await db.query<{
      id: string; name: string; description: string | null; color: string; member_ids: string[] | null; created_at: Date | string;
    }>(
      `SELECT t.id, t.name, t.description, t.color, t.created_at,
         COALESCE(array_agg(tm.user_id) FILTER (WHERE tm.user_id IS NOT NULL), '{}') AS member_ids
       FROM teams t LEFT JOIN team_members tm ON tm.team_id = t.id
       WHERE t.workspace_id = $1 GROUP BY t.id ORDER BY t.name`,
      [workspaceId],
    );
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      color: r.color,
      memberIds: r.member_ids ?? [],
      createdAt: toISO(r.created_at),
    }));
  },
};
