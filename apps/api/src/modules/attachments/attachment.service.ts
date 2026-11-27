import { randomUUID } from "node:crypto";
import { can, PLANS, type Attachment, type PlanId, type Role, type StorageUsage } from "@andamo/shared";
import { integrations } from "../../config/env";
import { db, type Queryable } from "../../db";
import { enqueue } from "../../jobs/queue";
import { registerJob, registerSchedule } from "../../jobs/worker";
import { r2, StorageUnavailableError } from "../../lib/r2";
import { toISO } from "../../shared/dates";
import { BadRequestError, ForbiddenError, NotFoundError, PlanLimitError } from "../../shared/errors";
import { notificationService } from "../notifications/notification.service";

export interface FileContext {
  workspaceId: string;
  userId: string;
  role: Role;
  plan: PlanId;
}

interface Row {
  id: string;
  project_id: string;
  task_id: string | null;
  uploaded_by: string | null;
  uploader_name: string | null;
  uploader_avatar: string | null;
  storage_key: string;
  file_name: string;
  content_type: string;
  size_bytes: string | number;
  status: "pending" | "ready";
  created_at: Date | string;
}

const SELECT = `SELECT a.id, a.project_id, a.task_id, a.uploaded_by, u.name AS uploader_name, u.avatar_url AS uploader_avatar,
    a.storage_key, a.file_name, a.content_type, a.size_bytes, a.status, a.created_at
  FROM attachments a LEFT JOIN users u ON u.id = a.uploaded_by
  JOIN projects p ON p.id = a.project_id AND p.deleted_at IS NULL
  LEFT JOIN tasks t ON t.id = a.task_id`;
// Arquivo visível: não excluído, projeto ativo e (se for de tarefa) tarefa fora da lixeira.
const VISIBLE = `a.deleted_at IS NULL AND (a.task_id IS NULL OR t.deleted_at IS NULL)`;

const toDTO = (r: Row): Attachment => ({
  id: r.id, projectId: r.project_id, taskId: r.task_id, fileName: r.file_name, contentType: r.content_type,
  sizeBytes: Number(r.size_bytes),
  uploadedBy: r.uploaded_by && r.uploader_name ? { id: r.uploaded_by, name: r.uploader_name, avatarUrl: r.uploader_avatar } : null,
  createdAt: toISO(r.created_at),
});

function requireStorage() {
  if (!integrations.storage) throw new StorageUnavailableError();
}

async function find(ctx: FileContext, id: string, status: "pending" | "ready" = "ready"): Promise<Row> {
  const { rows } = await db.query<Row>(`${SELECT} WHERE a.id = $1 AND a.workspace_id = $2 AND a.status = $3 AND ${VISIBLE}`, [id, ctx.workspaceId, status]);
  if (!rows[0]) throw new NotFoundError("Arquivo");
  return rows[0];
}

async function usedBytes(workspaceId: string, q: Queryable = db): Promise<number> {
  // Pendentes recentes contam (evita estourar o limite com vários envios simultâneos).
  const { rows } = await q.query<{ n: string }>(
    `SELECT COALESCE(sum(size_bytes), 0)::text AS n FROM attachments
     WHERE workspace_id = $1 AND deleted_at IS NULL AND (status = 'ready' OR created_at > now() - interval '2 hours')`,
    [workspaceId],
  );
  return Number(rows[0].n);
}

/** Agenda a exclusão do objeto no R2 (com retry pela fila). */
export async function scheduleObjectDeletion(keys: string[], q: Queryable = db) {
  for (const key of keys) await enqueue("storage.delete", { key }, { dedupeKey: `storage.delete:${key}` }, q);
}

export const attachmentService = {
  async usage(ctx: FileContext): Promise<StorageUsage> {
    return { available: integrations.storage, usedBytes: await usedBytes(ctx.workspaceId), limitBytes: PLANS[ctx.plan].limits.storageMb * 1024 * 1024 };
  },

  async list(ctx: FileContext, q: { projectId?: string; taskId?: string }): Promise<Attachment[]> {
    const params: unknown[] = [ctx.workspaceId];
    let where = `a.workspace_id = $1 AND a.status = 'ready' AND ${VISIBLE}`;
    if (q.taskId) {
      params.push(q.taskId);
      where += ` AND a.task_id = $${params.length}`;
    } else {
      params.push(q.projectId);
      where += ` AND a.project_id = $${params.length}`;
    }
    const { rows } = await db.query<Row>(`${SELECT} WHERE ${where} ORDER BY a.created_at DESC LIMIT 200`, params);
    return rows.map(toDTO);
  },

  /** 1ª etapa do envio: confere permissão e limite, reserva o registro e devolve a URL de upload (15 min). */
  async create(ctx: FileContext, input: { projectId: string; taskId?: string; fileName: string; contentType: string; sizeBytes: number }) {
    requireStorage();
    if (!can(ctx.role, "tasks.edit")) throw new ForbiddenError("Seu papel neste workspace não permite enviar arquivos");
    const { rows: proj } = await db.query(`SELECT 1 FROM projects WHERE id = $1 AND workspace_id = $2 AND deleted_at IS NULL`, [input.projectId, ctx.workspaceId]);
    if (!proj[0]) throw new NotFoundError("Projeto");
    if (input.taskId) {
      const { rows } = await db.query(`SELECT 1 FROM tasks WHERE id = $1 AND project_id = $2 AND workspace_id = $3 AND deleted_at IS NULL`, [input.taskId, input.projectId, ctx.workspaceId]);
      if (!rows[0]) throw new NotFoundError("Tarefa");
    }
    const limit = PLANS[ctx.plan].limits.storageMb * 1024 * 1024;
    if ((await usedBytes(ctx.workspaceId)) + input.sizeBytes > limit) {
      throw new PlanLimitError(`Limite de armazenamento do plano ${PLANS[ctx.plan].name} atingido (${PLANS[ctx.plan].limits.storageMb} MB).`);
    }
    // A chave não carrega o nome original (evita vazar dados e problemas de codificação).
    const key = `w/${ctx.workspaceId}/${randomUUID()}`;
    const { rows } = await db.query<{ id: string }>(
      `INSERT INTO attachments (workspace_id, project_id, task_id, uploaded_by, storage_key, file_name, content_type, size_bytes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [ctx.workspaceId, input.projectId, input.taskId ?? null, ctx.userId, key, input.fileName, input.contentType, input.sizeBytes],
    );
    return { id: rows[0].id, uploadUrl: r2.uploadUrl(key), method: "PUT" as const, headers: { "content-type": input.contentType } };
  },

  /** 2ª etapa: confere no R2 que o arquivo chegou com o tamanho declarado e libera para a equipe. */
  async complete(ctx: FileContext, id: string): Promise<Attachment> {
    requireStorage();
    const row = await find(ctx, id, "pending");
    if (row.uploaded_by !== ctx.userId) throw new NotFoundError("Arquivo");
    const size = await r2.size(row.storage_key);
    if (size === null) throw new BadRequestError("O arquivo ainda não chegou ao armazenamento. Tente enviar de novo.", "UPLOAD_MISSING");
    if (size !== Number(row.size_bytes)) {
      await db.query(`UPDATE attachments SET deleted_at = now() WHERE id = $1`, [id]);
      await scheduleObjectDeletion([row.storage_key]);
      throw new BadRequestError("O tamanho do arquivo enviado não confere. Envie novamente.", "UPLOAD_SIZE_MISMATCH");
    }
    await db.query(`UPDATE attachments SET status = 'ready' WHERE id = $1`, [id]);
    if (row.task_id) {
      const { rows } = await db.query<{ user_id: string; title: string }>(
        `SELECT x.user_id, t.title FROM (SELECT user_id FROM task_assignees WHERE task_id = $1 UNION SELECT user_id FROM task_followers WHERE task_id = $1) x
         JOIN tasks t ON t.id = $1`,
        [row.task_id],
      );
      if (rows.length) {
        await notificationService.notify({
          userIds: rows.map((r) => r.user_id), workspaceId: ctx.workspaceId, type: "task.attachment", category: "tasks",
          title: `Novo anexo em “${rows[0].title}”`, body: row.file_name, actorId: ctx.userId,
          link: `/app/w/${ctx.workspaceId}/projetos/${row.project_id}?tarefa=${row.task_id}`, dedupeKey: `attachment:${id}`,
        });
      }
    }
    return toDTO({ ...row, status: "ready" });
  },

  /** URL de download de 60 s, gerada só para quem é membro do workspace (inclusive visualizadores). */
  async download(ctx: FileContext, id: string) {
    requireStorage();
    const row = await find(ctx, id);
    return { url: r2.downloadUrl(row.storage_key, row.file_name), expiresInSeconds: 60 };
  },

  /** Quem enviou ou um gestor pode excluir. O objeto some do R2 pela fila (com retry). */
  async remove(ctx: FileContext, id: string) {
    const row = await find(ctx, id);
    if (row.uploaded_by !== ctx.userId && !can(ctx.role, "projects.manage")) throw new ForbiddenError("Só quem enviou ou um gestor pode excluir este arquivo");
    await db.transaction(async (tx) => {
      await tx.query(`UPDATE attachments SET deleted_at = now() WHERE id = $1`, [id]);
      await scheduleObjectDeletion([row.storage_key], tx);
    });
  },
};

registerJob("storage.delete", async (payload) => {
  if (!integrations.storage) throw new Error("R2 não configurado: exclusão adiada");
  await r2.remove(String((payload as { key: string }).key));
});

/** Envios abandonados (pendentes há mais de 2 h) são descartados. */
registerJob("storage.cleanup", async () => {
  const { rows } = await db.query<{ storage_key: string }>(
    `UPDATE attachments SET deleted_at = now() WHERE status = 'pending' AND deleted_at IS NULL AND created_at < now() - interval '2 hours' RETURNING storage_key`,
  );
  await scheduleObjectDeletion(rows.map((r) => r.storage_key));
});
registerSchedule("storage.cleanup", 60);
