import {
  assignableRoles,
  can,
  PLANS,
  roleRank,
  type InvitationPreview,
  type Label,
  type PlanId,
  type Role,
  type Workspace,
} from "@andamo/shared";
import { db } from "../../db";
import { emit } from "../../events/bus";
import { randomToken, sha256 } from "../../lib/crypto";
import { refreshUserWorkspaces } from "../../realtime/hub";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError, PlanLimitError } from "../../shared/errors";
import { activityRepository } from "../activity/activity.repository";
import { audit } from "../audit/audit";
import { queueEmail } from "../email/email.service";
import { emailTemplates } from "../email/templates";
import { userRepository } from "../users/user.repository";
import { workspaceRepository as repo } from "./workspace.repository";

export interface WorkspaceContext {
  workspaceId: string;
  userId: string;
  role: Role;
  plan: PlanId;
  isPersonal: boolean;
}

/** Só se altera quem está abaixo de você na hierarquia (dono é intocável). */
function assertCanManageMember(actor: Role, target: Role) {
  if (target === "owner") throw new ForbiddenError("O proprietário só muda por transferência de propriedade");
  if (roleRank(target) > roleRank(actor) || (actor !== "owner" && roleRank(target) === roleRank(actor))) {
    throw new ForbiddenError("Você não pode alterar alguém com papel igual ou superior ao seu");
  }
}

async function assertMemberLimit(ctx: WorkspaceContext) {
  const limit = PLANS[ctx.plan].limits.members;
  if (limit !== null && (await repo.countMembers(ctx.workspaceId)) >= limit) {
    throw new PlanLimitError(`O plano ${PLANS[ctx.plan].name} permite até ${limit} membros. Faça upgrade para convidar mais pessoas.`);
  }
}

export const workspaceService = {
  list: (userId: string) => repo.listForUser(userId),

  async get(userId: string, workspaceId: string): Promise<Workspace> {
    const ws = await repo.getForUser(workspaceId, userId);
    if (!ws) throw new NotFoundError("Workspace");
    return ws;
  },

  async create(userId: string, name: string): Promise<Workspace> {
    const id = await db.transaction(async (tx) => {
      const wsId = await repo.create({ name, ownerId: userId }, tx);
      await tx.query(
        `INSERT INTO projects (workspace_id, name, icon, owner_id, created_by, is_default)
         VALUES ($1, 'Primeiro projeto', 'rocket', $2, $2, false)`,
        [wsId, userId],
      );
      return wsId;
    });
    await activityRepository.log({ workspaceId: id, actorId: userId, entityType: "workspace", entityId: id, action: "workspace.created", data: { name } });
    await refreshUserWorkspaces(userId);
    return this.get(userId, id);
  },

  async update(ctx: WorkspaceContext, data: { name?: string; logoUrl?: string | null }): Promise<Workspace> {
    await repo.update(ctx.workspaceId, data);
    await activityRepository.log({
      workspaceId: ctx.workspaceId, actorId: ctx.userId, entityType: "workspace", entityId: ctx.workspaceId,
      action: "workspace.updated", data: { changes: Object.keys(data) },
    });
    return this.get(ctx.userId, ctx.workspaceId);
  },

  async setArchived(ctx: WorkspaceContext, archived: boolean, ip: string | null): Promise<Workspace> {
    if (ctx.isPersonal && archived) throw new BadRequestError("O workspace pessoal não pode ser arquivado");
    await repo.setArchived(ctx.workspaceId, archived);
    await audit({ actorId: ctx.userId, workspaceId: ctx.workspaceId, action: archived ? "workspace.archived" : "workspace.unarchived", ip });
    return this.get(ctx.userId, ctx.workspaceId);
  },

  async transferOwnership(ctx: WorkspaceContext, toUserId: string, ip: string | null): Promise<Workspace> {
    if (toUserId === ctx.userId) throw new BadRequestError("Você já é o proprietário");
    const targetRole = await repo.memberRole(ctx.workspaceId, toUserId);
    if (!targetRole) throw new NotFoundError("Membro");
    if (targetRole === "guest" || targetRole === "viewer") throw new BadRequestError("Promova a pessoa a membro antes de transferir");
    await db.transaction((tx) => repo.transferOwnership(ctx.workspaceId, ctx.userId, toUserId, tx));
    await audit({ actorId: ctx.userId, workspaceId: ctx.workspaceId, action: "workspace.ownership_transferred", target: toUserId, ip });
    await emit("member.role_changed", { workspaceId: ctx.workspaceId, userId: toUserId, from: targetRole, to: "owner", actorId: ctx.userId });
    return this.get(ctx.userId, ctx.workspaceId);
  },

  // ------------------------------------------------------------ membros
  members: (ctx: WorkspaceContext) => repo.members(ctx.workspaceId),

  async updateMember(
    ctx: WorkspaceContext,
    userId: string,
    data: { role?: Role; jobTitle?: string | null; department?: string | null; capacityHours?: number | null },
    ip: string | null,
  ) {
    const current = await repo.memberRole(ctx.workspaceId, userId);
    if (!current) throw new NotFoundError("Membro");
    const editingSelf = userId === ctx.userId;
    if (data.role !== undefined && data.role !== current) {
      if (!can(ctx.role, "members.manage")) throw new ForbiddenError();
      assertCanManageMember(ctx.role, current);
      if (!assignableRoles(ctx.role).includes(data.role)) throw new ForbiddenError("Você não pode atribuir esse papel");
    } else if (!editingSelf && !can(ctx.role, "members.manage")) {
      throw new ForbiddenError();
    }
    await repo.updateMember(ctx.workspaceId, userId, data);
    if (data.role && data.role !== current) {
      await audit({ actorId: ctx.userId, workspaceId: ctx.workspaceId, action: "member.role_changed", target: userId, ip, data: { from: current, to: data.role } });
      await emit("member.role_changed", { workspaceId: ctx.workspaceId, userId, from: current, to: data.role, actorId: ctx.userId });
    }
    return (await repo.members(ctx.workspaceId)).find((m) => m.id === userId)!;
  },

  /** Remove um membro (ou sai do workspace, se for o próprio usuário). */
  async removeMember(ctx: WorkspaceContext, userId: string, ip: string | null) {
    const target = await repo.memberRole(ctx.workspaceId, userId);
    if (!target) throw new NotFoundError("Membro");
    if (target === "owner") throw new BadRequestError("Transfira a propriedade antes de sair do workspace");
    if (userId !== ctx.userId) {
      if (!can(ctx.role, "members.manage")) throw new ForbiddenError();
      assertCanManageMember(ctx.role, target);
    }
    await db.transaction((tx) => repo.removeMember(ctx.workspaceId, userId, tx));
    await audit({ actorId: ctx.userId, workspaceId: ctx.workspaceId, action: "member.removed", target: userId, ip });
    await refreshUserWorkspaces(userId);
    await emit("member.removed", { workspaceId: ctx.workspaceId, userId, actorId: ctx.userId });
  },

  // ------------------------------------------------------------ convites
  invitations: (ctx: WorkspaceContext) => repo.invitations(ctx.workspaceId),

  async invite(ctx: WorkspaceContext, email: string, role: Role) {
    if (ctx.isPersonal) throw new BadRequestError("Crie um workspace de equipe para convidar pessoas", "PERSONAL_WORKSPACE");
    if (!assignableRoles(ctx.role).includes(role)) throw new ForbiddenError("Você não pode convidar com esse papel");
    if ((role === "guest" || role === "viewer") && !PLANS[ctx.plan].features.guests) {
      throw new PlanLimitError("Convidados e visualizadores estão disponíveis a partir do plano Pro");
    }
    const existingUser = await userRepository.findByEmail(email);
    if (existingUser && (await repo.memberRole(ctx.workspaceId, existingUser.id))) {
      throw new ConflictError("Essa pessoa já é membro do workspace", "ALREADY_MEMBER");
    }
    await assertMemberLimit(ctx);

    const token = randomToken(32);
    await db.query(
      `UPDATE workspace_invitations SET revoked_at = now()
       WHERE workspace_id = $1 AND lower(email) = $2 AND accepted_at IS NULL AND revoked_at IS NULL`,
      [ctx.workspaceId, email],
    );
    const { rows } = await db.query<{ id: string }>(
      `INSERT INTO workspace_invitations (workspace_id, email, role, token_hash, invited_by, expires_at)
       VALUES ($1, $2, $3, $4, $5, now() + interval '7 days') RETURNING id`,
      [ctx.workspaceId, email, role, sha256(token), ctx.userId],
    );
    const [inviter, ws] = await Promise.all([userRepository.findById(ctx.userId), this.get(ctx.userId, ctx.workspaceId)]);
    await queueEmail(email, emailTemplates.invitation(inviter?.name ?? "Alguém", ws.name, token), { userId: existingUser?.id });
    await emit("member.invited", { workspaceId: ctx.workspaceId, email, role, actorId: ctx.userId, userId: existingUser?.id ?? null });
    return { id: rows[0].id };
  },

  async revokeInvitation(ctx: WorkspaceContext, invitationId: string) {
    const { rows } = await db.query(
      `UPDATE workspace_invitations SET revoked_at = now() WHERE id = $1 AND workspace_id = $2 AND accepted_at IS NULL RETURNING id`,
      [invitationId, ctx.workspaceId],
    );
    if (!rows[0]) throw new NotFoundError("Convite");
  },

  async previewInvitation(token: string): Promise<InvitationPreview> {
    const { rows } = await db.query<{ name: string; email: string; role: Role; inviter: string | null; expired: boolean }>(
      `SELECT w.name, i.email, i.role, u.name AS inviter,
         (i.expires_at <= now() OR i.revoked_at IS NOT NULL OR i.accepted_at IS NOT NULL) AS expired
       FROM workspace_invitations i JOIN workspaces w ON w.id = i.workspace_id LEFT JOIN users u ON u.id = i.invited_by
       WHERE i.token_hash = $1`,
      [sha256(token)],
    );
    if (!rows[0]) throw new NotFoundError("Convite");
    const r = rows[0];
    return { workspaceName: r.name, email: r.email, role: r.role, inviterName: r.inviter, expired: r.expired };
  },

  /** Aceite: o convite vale apenas para o e-mail convidado (evita repasse de links). */
  async acceptInvitation(userId: string, token: string): Promise<Workspace> {
    const user = await userRepository.findById(userId);
    if (!user) throw new NotFoundError("Usuário");
    const workspaceId = await db.transaction(async (tx) => {
      const { rows } = await tx.query<{ id: string; workspace_id: string; email: string; role: Role }>(
        `SELECT id, workspace_id, email, role FROM workspace_invitations
         WHERE token_hash = $1 AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > now() FOR UPDATE`,
        [sha256(token)],
      );
      const inv = rows[0];
      if (!inv) throw new BadRequestError("Convite inválido ou expirado", "INVALID_INVITATION");
      if (inv.email.toLowerCase() !== user.email.toLowerCase()) {
        throw new ForbiddenError(`Este convite foi enviado para ${inv.email}. Entre com essa conta para aceitar.`, "INVITATION_EMAIL_MISMATCH");
      }
      await repo.addMember(inv.workspace_id, userId, inv.role, tx);
      await tx.query(`UPDATE workspace_invitations SET accepted_at = now() WHERE id = $1`, [inv.id]);
      await activityRepository.log({ workspaceId: inv.workspace_id, actorId: userId, entityType: "member", entityId: userId, action: "member.joined", data: { name: user.name } }, tx);
      return inv.workspace_id;
    });
    await refreshUserWorkspaces(userId);
    await emit("member.joined", { workspaceId, userId, actorId: userId });
    return this.get(userId, workspaceId);
  },

  // ------------------------------------------------------------ equipes
  teams: (ctx: WorkspaceContext) => repo.teams(ctx.workspaceId),

  async saveTeam(ctx: WorkspaceContext, teamId: string | null, data: { name: string; description: string | null; color: string; memberIds?: string[] }) {
    const id = await db.transaction(async (tx) => {
      let id = teamId;
      if (id) {
        const { rows } = await tx.query(
          `UPDATE teams SET name = $3, description = $4, color = $5 WHERE id = $1 AND workspace_id = $2 RETURNING id`,
          [id, ctx.workspaceId, data.name, data.description, data.color],
        );
        if (!rows[0]) throw new NotFoundError("Equipe");
      } else {
        const { rows } = await tx.query<{ id: string }>(
          `INSERT INTO teams (workspace_id, name, description, color) VALUES ($1, $2, $3, $4) RETURNING id`,
          [ctx.workspaceId, data.name, data.description, data.color],
        );
        id = rows[0].id;
      }
      if (data.memberIds) {
        const members = await repo.filterMembers(ctx.workspaceId, data.memberIds, tx);
        await tx.query(`DELETE FROM team_members WHERE team_id = $1`, [id]);
        if (members.length) await tx.query(`INSERT INTO team_members (team_id, user_id) SELECT $1, unnest($2::uuid[])`, [id, members]);
      }
      await activityRepository.log({ workspaceId: ctx.workspaceId, actorId: ctx.userId, entityType: "team", entityId: id!, action: teamId ? "team.updated" : "team.created", data: { name: data.name } }, tx);
      return id!;
    });
    return (await repo.teams(ctx.workspaceId)).find((t) => t.id === id)!;
  },

  async removeTeam(ctx: WorkspaceContext, teamId: string) {
    const { rows } = await db.query(`DELETE FROM teams WHERE id = $1 AND workspace_id = $2 RETURNING id`, [teamId, ctx.workspaceId]);
    if (!rows[0]) throw new NotFoundError("Equipe");
  },

  // ------------------------------------------------------------ etiquetas
  async labels(ctx: WorkspaceContext): Promise<Label[]> {
    const { rows } = await db.query<Label>(`SELECT id, name, color FROM labels WHERE workspace_id = $1 ORDER BY name`, [ctx.workspaceId]);
    return rows;
  },

  async createLabel(ctx: WorkspaceContext, data: { name: string; color: string }): Promise<Label> {
    const { rows } = await db.query<Label>(
      `INSERT INTO labels (workspace_id, name, color) VALUES ($1, $2, $3) RETURNING id, name, color`,
      [ctx.workspaceId, data.name, data.color],
    );
    return rows[0];
  },

  async updateLabel(ctx: WorkspaceContext, id: string, data: { name: string; color: string }): Promise<Label> {
    const { rows } = await db.query<Label>(
      `UPDATE labels SET name = $3, color = $4 WHERE id = $1 AND workspace_id = $2 RETURNING id, name, color`,
      [id, ctx.workspaceId, data.name, data.color],
    );
    if (!rows[0]) throw new NotFoundError("Etiqueta");
    return rows[0];
  },

  async removeLabel(ctx: WorkspaceContext, id: string) {
    const { rows } = await db.query(`DELETE FROM labels WHERE id = $1 AND workspace_id = $2 RETURNING id`, [id, ctx.workspaceId]);
    if (!rows[0]) throw new NotFoundError("Etiqueta");
  },
};
