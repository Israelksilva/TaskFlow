import { addDays, PLANS, type PlanId, type ReportData, type ReportTotals } from "@andamo/shared";
import { db } from "../../db";
import { PlanLimitError } from "../../shared/errors";
import { userRepository } from "../users/user.repository";

export interface ReportContext {
  workspaceId: string;
  userId: string;
  plan: PlanId;
}

interface Filters {
  projectId?: string;
  assigneeId?: string;
}

/**
 * Monta o filtro de tarefas (tenant obrigatório) e os limites do período no fuso de quem consulta.
 * Parâmetros fixos: $1 workspace, $2 início, $3 fim (datas inclusivas), $4 fuso.
 */
function scope(f: Filters, params: unknown[]) {
  const where = [
    "t.workspace_id = $1",
    "t.parent_id IS NULL",
    "t.deleted_at IS NULL",
    "t.archived_at IS NULL",
    "EXISTS (SELECT 1 FROM projects p WHERE p.id = t.project_id AND p.deleted_at IS NULL)",
  ];
  if (f.projectId) {
    params.push(f.projectId);
    where.push(`t.project_id = $${params.length}`);
  }
  if (f.assigneeId) {
    params.push(f.assigneeId);
    where.push(`EXISTS (SELECT 1 FROM task_assignees a WHERE a.task_id = t.id AND a.user_id = $${params.length})`);
  }
  return where.join(" AND ");
}

const START = "($2::date::timestamp AT TIME ZONE $4)";
const END = "(($3::date + 1)::timestamp AT TIME ZONE $4)";
const DUR = "COALESCE(e.duration_seconds, extract(epoch FROM now() - e.started_at)::int)";

async function totals(ws: string, from: string, to: string, tz: string, f: Filters): Promise<ReportTotals> {
  const params: unknown[] = [ws, from, to, tz];
  const where = scope(f, params);
  const timeParams: unknown[] = [ws, from, to, tz];
  const timeWhere = scope({ projectId: f.projectId }, timeParams);
  const userFilter = f.assigneeId ? (timeParams.push(f.assigneeId), ` AND e.user_id = $${timeParams.length}`) : "";

  const [{ rows }, time] = await Promise.all([
    db.query<{
      created: number; completed: number; open_at_end: number; overdue: number;
      avg_hours: number | null; with_due: number; on_time: number;
    }>(
      `SELECT
         count(*) FILTER (WHERE t.created_at >= ${START} AND t.created_at < ${END})::int AS created,
         count(*) FILTER (WHERE t.completed_at >= ${START} AND t.completed_at < ${END})::int AS completed,
         count(*) FILTER (WHERE t.created_at < ${END} AND (t.completed_at IS NULL OR t.completed_at >= ${END}))::int AS open_at_end,
         count(*) FILTER (WHERE t.created_at < ${END} AND (t.completed_at IS NULL OR t.completed_at >= ${END}) AND t.due_date <= $3::date)::int AS overdue,
         avg(extract(epoch FROM t.completed_at - t.created_at) / 3600) FILTER (WHERE t.completed_at >= ${START} AND t.completed_at < ${END}) AS avg_hours,
         count(*) FILTER (WHERE t.completed_at >= ${START} AND t.completed_at < ${END} AND t.due_date IS NOT NULL)::int AS with_due,
         count(*) FILTER (WHERE t.completed_at >= ${START} AND t.completed_at < ${END} AND t.due_date IS NOT NULL
           AND (t.completed_at AT TIME ZONE $4)::date <= t.due_date)::int AS on_time
       FROM tasks t WHERE ${where}`,
      params,
    ),
    db.query<{ seconds: number }>(
      `SELECT COALESCE(sum(${DUR}), 0)::int AS seconds
       FROM time_entries e JOIN tasks t ON t.id = e.task_id
       WHERE e.started_at >= ${START} AND e.started_at < ${END} AND ${timeWhere.replace("t.parent_id IS NULL AND ", "")}${userFilter}`,
      timeParams,
    ),
  ]);
  const r = rows[0];
  const base = r.completed + r.open_at_end;
  return {
    created: r.created,
    completed: r.completed,
    overdue: r.overdue,
    completionRate: base ? Math.round((r.completed / base) * 100) : 0,
    avgCompletionHours: r.avg_hours === null ? null : Math.round(Number(r.avg_hours) * 10) / 10,
    onTimeRate: r.with_due ? Math.round((r.on_time / r.with_due) * 100) : null,
    trackedSeconds: time.rows[0].seconds,
  };
}

export const reportService = {
  async get(ctx: ReportContext, q: { from: string; to: string } & Filters): Promise<ReportData> {
    if (!PLANS[ctx.plan].features.reports) throw new PlanLimitError(`Relatórios não estão incluídos no plano ${PLANS[ctx.plan].name}`);
    const tz = (await userRepository.findById(ctx.userId))?.timezone ?? "America/Sao_Paulo";
    const days = Math.round((Date.parse(q.to) - Date.parse(q.from)) / 864e5) + 1;
    const previous = { from: addDays(q.from, -days), to: addDays(q.from, -1) };
    const granularity = days <= 31 ? "day" : "week";
    const f: Filters = { projectId: q.projectId, assigneeId: q.assigneeId };

    const params: unknown[] = [ctx.workspaceId, q.from, q.to, tz];
    const where = scope(f, params);
    const unit = granularity === "day" ? "day" : "week";
    // Mesmos filtros de projeto/pessoa para as horas da série (pessoa = quem apontou o tempo).
    const timeFilter =
      (f.projectId ? ` AND t.project_id = $${params.indexOf(f.projectId) + 1}` : "") +
      (f.assigneeId ? ` AND e.user_id = $${params.indexOf(f.assigneeId) + 1}` : "");

    const [current, prev, series, byProject, byPerson, byPriority] = await Promise.all([
      totals(ctx.workspaceId, q.from, q.to, tz, f),
      totals(ctx.workspaceId, previous.from, previous.to, tz, f),
      db.query<{ bucket: string; created: number; completed: number; tracked: number }>(
        `WITH buckets AS (
           SELECT generate_series(date_trunc('${unit}', $2::date), $3::date, interval '1 ${unit}')::date AS bucket
         )
         SELECT b.bucket::text AS bucket,
           (SELECT count(*)::int FROM tasks t WHERE ${where}
              AND date_trunc('${unit}', (t.created_at AT TIME ZONE $4))::date = b.bucket
              AND t.created_at >= ${START} AND t.created_at < ${END}) AS created,
           (SELECT count(*)::int FROM tasks t WHERE ${where}
              AND date_trunc('${unit}', (t.completed_at AT TIME ZONE $4))::date = b.bucket
              AND t.completed_at >= ${START} AND t.completed_at < ${END}) AS completed,
           (SELECT COALESCE(sum(${DUR}), 0)::int FROM time_entries e JOIN tasks t ON t.id = e.task_id
              WHERE t.workspace_id = $1 AND date_trunc('${unit}', (e.started_at AT TIME ZONE $4))::date = b.bucket
              AND e.started_at >= ${START} AND e.started_at < ${END}${timeFilter}) AS tracked
         FROM buckets b ORDER BY b.bucket`,
        params,
      ),
      db.query<{ id: string; name: string; color: string; open: number; completed: number; overdue: number; avg_hours: number | null; tracked: number }>(
        `SELECT p.id, p.name, p.color,
           count(t.id) FILTER (WHERE t.completed_at IS NULL)::int AS open,
           count(t.id) FILTER (WHERE t.completed_at >= ${START} AND t.completed_at < ${END})::int AS completed,
           count(t.id) FILTER (WHERE t.completed_at IS NULL AND t.due_date <= $3::date)::int AS overdue,
           avg(extract(epoch FROM t.completed_at - t.created_at) / 3600) FILTER (WHERE t.completed_at >= ${START} AND t.completed_at < ${END}) AS avg_hours,
           (SELECT COALESCE(sum(${DUR}), 0)::int FROM time_entries e JOIN tasks x ON x.id = e.task_id
              WHERE x.project_id = p.id AND e.started_at >= ${START} AND e.started_at < ${END}) AS tracked
         FROM projects p LEFT JOIN tasks t ON t.project_id = p.id AND ${where}
         WHERE p.workspace_id = $1 AND p.deleted_at IS NULL AND NOT p.is_template ${f.projectId ? `AND p.id = $5` : ""}
         GROUP BY p.id ORDER BY completed DESC, open DESC`,
        params,
      ),
      db.query<{ id: string; name: string; avatar_url: string | null; capacity_hours: number | null; open: number; completed: number; overdue: number; estimate: number; tracked: number }>(
        `SELECT u.id, u.name, u.avatar_url, m.capacity_hours,
           count(t.id) FILTER (WHERE t.completed_at IS NULL)::int AS open,
           count(t.id) FILTER (WHERE t.completed_at >= ${START} AND t.completed_at < ${END})::int AS completed,
           count(t.id) FILTER (WHERE t.completed_at IS NULL AND t.due_date <= $3::date)::int AS overdue,
           COALESCE(sum(t.estimate_minutes) FILTER (WHERE t.completed_at IS NULL), 0)::int AS estimate,
           (SELECT COALESCE(sum(${DUR}), 0)::int FROM time_entries e
              WHERE e.user_id = u.id AND e.workspace_id = $1 AND e.started_at >= ${START} AND e.started_at < ${END}) AS tracked
         FROM workspace_members m JOIN users u ON u.id = m.user_id
         LEFT JOIN task_assignees a ON a.user_id = u.id
         LEFT JOIN tasks t ON t.id = a.task_id AND ${where}
         WHERE m.workspace_id = $1 AND u.deleted_at IS NULL
         GROUP BY u.id, m.capacity_hours ORDER BY completed DESC, open DESC`,
        params,
      ),
      db.query<{ priority: string; open: number; completed: number }>(
        `SELECT t.priority,
           count(*) FILTER (WHERE t.completed_at IS NULL)::int AS open,
           count(*) FILTER (WHERE t.completed_at >= ${START} AND t.completed_at < ${END})::int AS completed
         FROM tasks t WHERE ${where} GROUP BY t.priority`,
        params,
      ),
    ]);

    const round = (v: number | null) => (v === null ? null : Math.round(Number(v) * 10) / 10);
    return {
      period: { from: q.from, to: q.to },
      previous,
      totals: current,
      previousTotals: prev,
      granularity,
      series: series.rows.map((r) => ({ bucket: r.bucket, created: r.created, completed: r.completed, trackedSeconds: r.tracked })),
      byProject: byProject.rows.map((r) => ({
        projectId: r.id, name: r.name, color: r.color, open: r.open, completed: r.completed, overdue: r.overdue,
        avgCompletionHours: round(r.avg_hours), trackedSeconds: r.tracked,
      })),
      byPerson: byPerson.rows.map((r) => ({
        user: { id: r.id, name: r.name, avatarUrl: r.avatar_url }, open: r.open, completed: r.completed, overdue: r.overdue,
        trackedSeconds: r.tracked, openEstimateMinutes: r.estimate, capacityHours: r.capacity_hours,
      })),
      byPriority: byPriority.rows,
    };
  },
};
