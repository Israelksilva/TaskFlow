import { can, PLANS, type PlanId, type Role, type TimeEntry, type TimeSummary } from "@andamo/shared";
import { db, type Queryable } from "../../db";
import { publishToUser, publishToWorkspace } from "../../realtime/hub";
import { toISO } from "../../shared/dates";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError, PlanLimitError } from "../../shared/errors";
import { taskService, type TaskContext } from "../tasks/task.service";
import { userRepository } from "../users/user.repository";

export interface TimeContext extends TaskContext {
  plan: PlanId;
}

interface EntryRow {
  id: string;
  workspace_id: string;
  task_id: string;
  task_title: string;
  project_id: string;
  user_id: string;
  user_name: string;
  user_avatar: string | null;
  started_at: Date | string;
  ended_at: Date | string | null;
  duration_seconds: number;
  note: string | null;
  source: "timer" | "manual";
}

/** Duração do cronômetro em andamento é calculada até agora. */
const SELECT = `SELECT e.id, e.workspace_id, e.task_id, t.title AS task_title, t.project_id, e.user_id,
    u.name AS user_name, u.avatar_url AS user_avatar, e.started_at, e.ended_at,
    COALESCE(e.duration_seconds, extract(epoch FROM now() - e.started_at)::int) AS duration_seconds, e.note, e.source
  FROM time_entries e JOIN tasks t ON t.id = e.task_id JOIN users u ON u.id = e.user_id`;

const toDTO = (r: EntryRow): TimeEntry => ({
  id: r.id,
  workspaceId: r.workspace_id,
  taskId: r.task_id,
  taskTitle: r.task_title,
  projectId: r.project_id,
  user: { id: r.user_id, name: r.user_name, avatarUrl: r.user_avatar },
  startedAt: toISO(r.started_at),
  endedAt: r.ended_at ? toISO(r.ended_at) : null,
  durationSeconds: Math.max(0, r.duration_seconds),
  note: r.note,
  source: r.source,
});

function assertFeature(ctx: TimeContext) {
  if (!PLANS[ctx.plan].features.timeTracking) {
    throw new PlanLimitError(`O controle de tempo não está incluído no plano ${PLANS[ctx.plan].name}`);
  }
}

/** Quem pode apontar tempo: quem pode editar tarefas, ou convidado nas tarefas atribuídas a ele. */
function assertCanTrack(ctx: TaskContext, assigneeIds: string[]) {
  if (can(ctx.role, "tasks.edit")) return;
  if (can(ctx.role, "tasks.editAssigned") && assigneeIds.includes(ctx.userId)) return;
  throw new ForbiddenError("Você não pode registrar tempo nesta tarefa");
}

/** Editar/excluir: o próprio autor ou gestores+ (correções de apontamento da equipe). */
function assertCanModify(role: Role, userId: string, entry: EntryRow) {
  if (entry.user_id === userId || can(role, "projects.manage")) return;
  throw new ForbiddenError("Você só pode alterar os seus registros de tempo");
}

async function findInWorkspace(workspaceId: string, id: string, tx: Queryable = db): Promise<EntryRow> {
  const { rows } = await tx.query<EntryRow>(`${SELECT} WHERE e.id = $1 AND e.workspace_id = $2`, [id, workspaceId]);
  if (!rows[0]) throw new NotFoundError("Registro de tempo");
  return rows[0];
}

/** Encerra o cronômetro rodando do usuário (em qualquer workspace). */
async function stopRunning(userId: string, tx: Queryable = db): Promise<EntryRow | null> {
  const { rows } = await tx.query<{ id: string; workspace_id: string }>(
    `UPDATE time_entries SET ended_at = now(), updated_at = now(),
       duration_seconds = GREATEST(0, extract(epoch FROM now() - started_at)::int)
     WHERE user_id = $1 AND ended_at IS NULL RETURNING id, workspace_id`,
    [userId],
  );
  if (!rows[0]) return null;
  return findInWorkspace(rows[0].workspace_id, rows[0].id, tx);
}

function notify(entry: TimeEntry) {
  publishToUser(entry.user.id, { type: "timer.changed" });
  publishToWorkspace(entry.workspaceId, { type: "task.changed", kind: "time", taskId: entry.taskId, projectId: entry.projectId });
}

export const timeService = {
  /** Cronômetro em andamento do usuário (no máximo um, garantido por índice único). */
  async running(userId: string): Promise<TimeEntry | null> {
    const { rows } = await db.query<EntryRow>(`${SELECT} WHERE e.user_id = $1 AND e.ended_at IS NULL`, [userId]);
    return rows[0] ? toDTO(rows[0]) : null;
  },

  async start(ctx: TimeContext, taskId: string, switchRunning: boolean): Promise<TimeEntry> {
    assertFeature(ctx);
    const task = await taskService.loadOrFail(ctx, taskId);
    assertCanTrack(ctx, task.assigneeIds);
    const entry = await db.transaction(async (tx) => {
      const { rows: running } = await tx.query<{ task_id: string }>(
        `SELECT task_id FROM time_entries WHERE user_id = $1 AND ended_at IS NULL FOR UPDATE`,
        [ctx.userId],
      );
      if (running[0]) {
        if (running[0].task_id === taskId) throw new ConflictError("O cronômetro desta tarefa já está rodando", "TIMER_ALREADY_RUNNING");
        if (!switchRunning) throw new ConflictError("Você já tem um cronômetro rodando em outra tarefa", "TIMER_RUNNING");
        await stopRunning(ctx.userId, tx);
      }
      const { rows } = await tx.query<{ id: string }>(
        `INSERT INTO time_entries (workspace_id, task_id, user_id, started_at, source) VALUES ($1, $2, $3, now(), 'timer') RETURNING id`,
        [ctx.workspaceId, taskId, ctx.userId],
      );
      return toDTO(await findInWorkspace(ctx.workspaceId, rows[0].id, tx));
    });
    notify(entry);
    return entry;
  },

  async stop(userId: string): Promise<TimeEntry | null> {
    const row = await stopRunning(userId);
    if (!row) return null;
    const entry = toDTO(row);
    notify(entry);
    return entry;
  },

  async addManual(ctx: TimeContext, taskId: string, input: { startedAt: string; minutes: number; note: string | null }): Promise<TimeEntry> {
    assertFeature(ctx);
    const task = await taskService.loadOrFail(ctx, taskId);
    assertCanTrack(ctx, task.assigneeIds);
    const start = new Date(input.startedAt);
    if (start.getTime() > Date.now()) throw new BadRequestError("Não é possível registrar tempo no futuro");
    const seconds = input.minutes * 60;
    const { rows } = await db.query<{ id: string }>(
      `INSERT INTO time_entries (workspace_id, task_id, user_id, started_at, ended_at, duration_seconds, note, source)
       VALUES ($1, $2, $3, $4, $4::timestamptz + make_interval(secs => $5), $5, $6, 'manual') RETURNING id`,
      [ctx.workspaceId, taskId, ctx.userId, start.toISOString(), seconds, input.note],
    );
    const entry = toDTO(await findInWorkspace(ctx.workspaceId, rows[0].id));
    notify(entry);
    return entry;
  },

  async update(ctx: TimeContext, id: string, input: { startedAt?: string; minutes?: number; note?: string | null }): Promise<TimeEntry> {
    const current = await findInWorkspace(ctx.workspaceId, id);
    assertCanModify(ctx.role, ctx.userId, current);
    if (!current.ended_at && (input.startedAt || input.minutes)) {
      throw new BadRequestError("Pare o cronômetro antes de ajustar o horário ou a duração");
    }
    const start = input.startedAt ?? toISO(current.started_at);
    const seconds = input.minutes !== undefined ? input.minutes * 60 : current.duration_seconds;
    await db.query(
      `UPDATE time_entries SET started_at = $2, note = $4, updated_at = now(),
         duration_seconds = CASE WHEN ended_at IS NULL THEN NULL ELSE $3::int END,
         ended_at = CASE WHEN ended_at IS NULL THEN NULL ELSE $2::timestamptz + make_interval(secs => $3) END
       WHERE id = $1`,
      [id, start, seconds, input.note !== undefined ? input.note : current.note],
    );
    const entry = toDTO(await findInWorkspace(ctx.workspaceId, id));
    notify(entry);
    return entry;
  },

  async remove(ctx: TimeContext, id: string): Promise<void> {
    const current = await findInWorkspace(ctx.workspaceId, id);
    assertCanModify(ctx.role, ctx.userId, current);
    await db.query(`DELETE FROM time_entries WHERE id = $1`, [id]);
    notify(toDTO(current));
  },

  /** Registros do período (no fuso do usuário), com filtros; respeita o tenant. */
  async list(ctx: TimeContext, q: { from: string; to: string; userId?: string; projectId?: string; taskId?: string }): Promise<TimeEntry[]> {
    const { where, params } = await filters(ctx, q);
    const { rows } = await db.query<EntryRow>(`${SELECT} WHERE ${where} ORDER BY e.started_at DESC LIMIT 2000`, params);
    return rows.map(toDTO);
  },

  async summary(ctx: TimeContext, q: { from: string; to: string; userId?: string; projectId?: string }): Promise<TimeSummary> {
    const { where, params, tz } = await filters(ctx, q);
    const dur = `COALESCE(e.duration_seconds, extract(epoch FROM now() - e.started_at)::int)`;
    const base = `FROM time_entries e JOIN tasks t ON t.id = e.task_id JOIN users u ON u.id = e.user_id WHERE ${where}`;
    const [byProject, byUser, byTask, byDay] = await Promise.all([
      db.query<{ project_id: string; name: string; color: string; seconds: number }>(
        `SELECT p.id AS project_id, p.name, p.color, sum(${dur})::int AS seconds ${base.replace("WHERE", "JOIN projects p ON p.id = t.project_id WHERE")}
         GROUP BY p.id ORDER BY seconds DESC`,
        params,
      ),
      db.query<{ id: string; name: string; avatar_url: string | null; seconds: number }>(
        `SELECT u.id, u.name, u.avatar_url, sum(${dur})::int AS seconds ${base} GROUP BY u.id ORDER BY seconds DESC`,
        params,
      ),
      db.query<{ task_id: string; project_id: string; title: string; estimate_minutes: number | null; seconds: number }>(
        `SELECT t.id AS task_id, t.project_id, t.title, t.estimate_minutes, sum(${dur})::int AS seconds ${base}
         GROUP BY t.id ORDER BY seconds DESC LIMIT 100`,
        params,
      ),
      db.query<{ date: string; seconds: number }>(
        `SELECT (e.started_at AT TIME ZONE $${params.length + 1})::date::text AS date, sum(${dur})::int AS seconds ${base}
         GROUP BY 1 ORDER BY 1`,
        [...params, tz],
      ),
    ]);
    return {
      totalSeconds: byUser.rows.reduce((a, r) => a + r.seconds, 0),
      byProject: byProject.rows.map((r) => ({ projectId: r.project_id, name: r.name, color: r.color, seconds: r.seconds })),
      byUser: byUser.rows.map((r) => ({ user: { id: r.id, name: r.name, avatarUrl: r.avatar_url }, seconds: r.seconds })),
      byTask: byTask.rows.map((r) => ({ taskId: r.task_id, projectId: r.project_id, title: r.title, estimateMinutes: r.estimate_minutes, trackedSeconds: r.seconds })),
      byDay: byDay.rows,
    };
  },
};

/** Filtros comuns: workspace obrigatório; período interpretado no fuso de quem consulta. */
async function filters(ctx: TimeContext, q: { from: string; to: string; userId?: string; projectId?: string; taskId?: string }) {
  if (q.to < q.from) throw new BadRequestError("O fim do período deve ser depois do início");
  const tz = (await userRepository.findById(ctx.userId))?.timezone ?? "America/Sao_Paulo";
  const params: unknown[] = [ctx.workspaceId, q.from, q.to, tz];
  const where = [
    "e.workspace_id = $1",
    "e.started_at >= ($2::date::timestamp AT TIME ZONE $4)",
    "e.started_at < (($3::date + 1)::timestamp AT TIME ZONE $4)",
  ];
  const add = (sql: string, v: unknown) => {
    params.push(v);
    where.push(sql.replace("?", `$${params.length}`));
  };
  if (q.userId) add("e.user_id = ?", q.userId === "me" ? ctx.userId : q.userId);
  if (q.projectId) add("t.project_id = ?", q.projectId);
  if (q.taskId) add("e.task_id = ?", q.taskId);
  return { where: where.join(" AND "), params, tz };
}
