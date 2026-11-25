import { can, type Comment } from "@andamo/shared";
import { db } from "../../db";
import { emit } from "../../events/bus";
import { publishToWorkspace } from "../../realtime/hub";
import { toISO } from "../../shared/dates";
import { ForbiddenError, NotFoundError } from "../../shared/errors";
import { activityRepository } from "../activity/activity.repository";
import { taskService, type TaskContext } from "../tasks/task.service";
import { workspaceRepository } from "../workspaces/workspace.repository";

/** Menções no formato `@[Nome](uuid)` (inseridas pelo editor do front-end). */
const MENTION = /@\[[^\]]{1,80}\]\(([0-9a-f-]{36})\)/gi;

export function extractMentions(body: string): string[] {
  return [...new Set([...body.matchAll(MENTION)].map((m) => m[1].toLowerCase()))];
}

interface CommentRow {
  id: string;
  task_id: string;
  parent_id: string | null;
  author_id: string | null;
  author_name: string | null;
  author_avatar: string | null;
  body: string;
  edited_at: Date | string | null;
  deleted_at: Date | string | null;
  created_at: Date | string;
  reactions: Array<{ emoji: string; count: number; mine: boolean }> | null;
}

const SELECT = `SELECT c.id, c.task_id, c.parent_id, c.author_id, u.name AS author_name, u.avatar_url AS author_avatar,
    c.body, c.edited_at, c.deleted_at, c.created_at,
    (SELECT json_agg(json_build_object('emoji', r.emoji, 'count', r.n, 'mine', r.mine))
       FROM (SELECT emoji, count(*)::int AS n, bool_or(user_id = $2) AS mine
             FROM comment_reactions WHERE comment_id = c.id GROUP BY emoji ORDER BY min(emoji)) r) AS reactions
  FROM comments c LEFT JOIN users u ON u.id = c.author_id`;

const toDTO = (r: CommentRow): Comment => ({
  id: r.id,
  taskId: r.task_id,
  parentId: r.parent_id,
  author: r.author_id && r.author_name ? { id: r.author_id, name: r.author_name, avatarUrl: r.author_avatar } : null,
  body: r.deleted_at ? "" : r.body,
  editedAt: r.edited_at ? toISO(r.edited_at) : null,
  createdAt: toISO(r.created_at),
  reactions: r.reactions ?? [],
});

async function findOrFail(ctx: TaskContext, taskId: string, commentId: string) {
  const { rows } = await db.query<CommentRow>(`${SELECT} WHERE c.id = $1 AND c.task_id = $3 AND c.deleted_at IS NULL`, [
    commentId,
    ctx.userId,
    taskId,
  ]);
  if (!rows[0]) throw new NotFoundError("Comentário");
  return rows[0];
}

function broadcast(ctx: TaskContext, taskId: string, projectId: string) {
  publishToWorkspace(ctx.workspaceId, { type: "comments.changed", taskId, projectId });
}

export const commentService = {
  async list(ctx: TaskContext, taskId: string): Promise<Comment[]> {
    await taskService.loadOrFail(ctx, taskId, undefined, true);
    const { rows } = await db.query<CommentRow>(
      `${SELECT} WHERE c.task_id = $1 AND (c.deleted_at IS NULL OR EXISTS (SELECT 1 FROM comments r WHERE r.parent_id = c.id AND r.deleted_at IS NULL))
       ORDER BY c.created_at`,
      [taskId, ctx.userId],
    );
    return rows.map(toDTO);
  },

  async create(ctx: TaskContext, taskId: string, body: string, parentId?: string): Promise<Comment> {
    if (!can(ctx.role, "comments.create")) throw new ForbiddenError();
    const task = await taskService.loadOrFail(ctx, taskId);
    if (parentId) await findOrFail(ctx, taskId, parentId);
    const mentionIds = await workspaceRepository.filterMembers(ctx.workspaceId, extractMentions(body));

    const comment = await db.transaction(async (tx) => {
      const { rows } = await tx.query<{ id: string }>(
        `INSERT INTO comments (task_id, author_id, parent_id, body) VALUES ($1, $2, $3, $4) RETURNING id`,
        [taskId, ctx.userId, parentId ?? null, body],
      );
      // Quem comenta (ou é mencionado) passa a acompanhar a tarefa.
      await tx.query(
        `INSERT INTO task_followers (task_id, user_id) SELECT $1, unnest($2::uuid[]) ON CONFLICT DO NOTHING`,
        [taskId, [ctx.userId, ...mentionIds]],
      );
      await activityRepository.log(
        { workspaceId: ctx.workspaceId, actorId: ctx.userId, entityType: "task", entityId: taskId, projectId: task.projectId, action: "comment.created", data: { title: task.title } },
        tx,
      );
      const created = await tx.query<CommentRow>(`${SELECT} WHERE c.id = $1`, [rows[0].id, ctx.userId]);
      return toDTO(created.rows[0]);
    });

    broadcast(ctx, taskId, task.projectId);
    await emit("comment.created", { comment, task, actorId: ctx.userId, mentionIds });
    return comment;
  },

  async update(ctx: TaskContext, taskId: string, commentId: string, body: string): Promise<Comment> {
    const current = await findOrFail(ctx, taskId, commentId);
    if (current.author_id !== ctx.userId) throw new ForbiddenError("Só o autor pode editar o comentário");
    await db.query(`UPDATE comments SET body = $2, edited_at = now() WHERE id = $1`, [commentId, body]);
    const task = await taskService.loadOrFail(ctx, taskId);
    broadcast(ctx, taskId, task.projectId);
    return toDTO(await findOrFail(ctx, taskId, commentId));
  },

  async remove(ctx: TaskContext, taskId: string, commentId: string): Promise<void> {
    const current = await findOrFail(ctx, taskId, commentId);
    if (current.author_id !== ctx.userId && !can(ctx.role, "members.manage")) throw new ForbiddenError();
    await db.query(`UPDATE comments SET deleted_at = now() WHERE id = $1`, [commentId]);
    const task = await taskService.loadOrFail(ctx, taskId, undefined, true);
    broadcast(ctx, taskId, task.projectId);
  },

  /** Alterna a reação do usuário (adiciona ou remove). */
  async toggleReaction(ctx: TaskContext, taskId: string, commentId: string, emoji: string): Promise<Comment> {
    if (!can(ctx.role, "comments.create")) throw new ForbiddenError();
    await findOrFail(ctx, taskId, commentId);
    const removed = await db.query(
      `DELETE FROM comment_reactions WHERE comment_id = $1 AND user_id = $2 AND emoji = $3 RETURNING emoji`,
      [commentId, ctx.userId, emoji],
    );
    if (!removed.rows.length) {
      await db.query(`INSERT INTO comment_reactions (comment_id, user_id, emoji) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`, [
        commentId,
        ctx.userId,
        emoji,
      ]);
    }
    const task = await taskService.loadOrFail(ctx, taskId);
    broadcast(ctx, taskId, task.projectId);
    return toDTO(await findOrFail(ctx, taskId, commentId));
  },
};
