import type { DashboardData, SearchResults } from "@andamo/shared";
import { normalizeText } from "@andamo/shared";
import { db } from "../../db";
import { activityRepository } from "../activity/activity.repository";
import { toTaskDTO } from "../tasks/task.mapper";
import { TASK_SELECT, type TaskRow } from "../tasks/task.repository";
import { userRepository } from "../users/user.repository";

const PERIOD_DAYS = { "7d": 7, "30d": 30, "90d": 90 } as const;

/** Todos os indicadores vêm do banco (nada é estimado ou fictício). */
export const dashboardService = {
  async get(
    workspaceId: string,
    userId: string,
    q: { period: keyof typeof PERIOD_DAYS; projectId?: string; assigneeId?: string },
  ): Promise<DashboardData> {
    const tz = (await userRepository.findById(userId))?.timezone ?? "America/Sao_Paulo";
    const days = PERIOD_DAYS[q.period];

    const params: unknown[] = [workspaceId];
    const where = [
      "t.workspace_id = $1",
      "t.deleted_at IS NULL",
      "t.archived_at IS NULL",
      "t.parent_id IS NULL",
      "EXISTS (SELECT 1 FROM projects p WHERE p.id = t.project_id AND p.deleted_at IS NULL)",
    ];
    if (q.projectId) {
      params.push(q.projectId);
      where.push(`t.project_id = $${params.length}`);
    }
    if (q.assigneeId) {
      params.push(q.assigneeId);
      where.push(`EXISTS (SELECT 1 FROM task_assignees a WHERE a.task_id = t.id AND a.user_id = $${params.length})`);
    }
    params.push(tz);
    const tzParam = `$${params.length}`;
    const today = `(now() AT TIME ZONE ${tzParam})::date`;
    const filter = where.join(" AND ");

    const [totals, series, upcoming, projects, productivity, activity] = await Promise.all([
      db.query<{ tasks: number; todo: number; doing: number; done: number; overdue: number; projects: number }>(
        `SELECT count(*)::int AS tasks,
           count(*) FILTER (WHERE t.status = 'todo')::int AS todo,
           count(*) FILTER (WHERE t.status = 'doing')::int AS doing,
           count(*) FILTER (WHERE t.status = 'done')::int AS done,
           count(*) FILTER (WHERE t.status <> 'done' AND t.due_date < ${today})::int AS overdue,
           (SELECT count(*)::int FROM projects p WHERE p.workspace_id = $1 AND p.deleted_at IS NULL AND p.archived_at IS NULL AND NOT p.is_template) AS projects
         FROM tasks t WHERE ${filter}`,
        params,
      ),
      db.query<{ date: string; created: number; completed: number }>(
        `SELECT d::date::text AS date,
           (SELECT count(*)::int FROM tasks t WHERE ${filter} AND (t.created_at AT TIME ZONE ${tzParam})::date = d::date) AS created,
           (SELECT count(*)::int FROM tasks t WHERE ${filter} AND t.status = 'done' AND (t.completed_at AT TIME ZONE ${tzParam})::date = d::date) AS completed
         FROM generate_series(${today} - ${days - 1}, ${today}, interval '1 day') d ORDER BY d`,
        params,
      ),
      db.query<TaskRow>(
        `${TASK_SELECT} WHERE ${filter} AND t.status <> 'done' AND t.due_date IS NOT NULL AND t.due_date <= ${today} + 14
         ORDER BY t.due_date, t.due_time NULLS LAST LIMIT 8`,
        params,
      ),
      db.query<{ id: string; name: string; color: string; icon: string; task_count: number; done_count: number; overdue_count: number }>(
        `SELECT p.id, p.name, p.color, p.icon,
           count(t.id)::int AS task_count,
           count(t.id) FILTER (WHERE t.status = 'done')::int AS done_count,
           count(t.id) FILTER (WHERE t.status <> 'done' AND t.due_date < (now() AT TIME ZONE $2)::date)::int AS overdue_count
         FROM projects p
         LEFT JOIN tasks t ON t.project_id = p.id AND t.parent_id IS NULL AND t.deleted_at IS NULL AND t.archived_at IS NULL
         WHERE p.workspace_id = $1 AND p.deleted_at IS NULL AND p.archived_at IS NULL AND NOT p.is_template
         GROUP BY p.id ORDER BY max(t.updated_at) DESC NULLS LAST LIMIT 6`,
        [workspaceId, tz],
      ),
      db.query<{ id: string; name: string; avatar_url: string | null; assigned: number; completed: number; overdue: number }>(
        `SELECT u.id, u.name, u.avatar_url,
           count(t.id) FILTER (WHERE t.status <> 'done')::int AS assigned,
           count(t.id) FILTER (WHERE t.status = 'done' AND t.completed_at >= now() - make_interval(days => $2))::int AS completed,
           count(t.id) FILTER (WHERE t.status <> 'done' AND t.due_date < (now() AT TIME ZONE $3)::date)::int AS overdue
         FROM workspace_members m JOIN users u ON u.id = m.user_id
         LEFT JOIN task_assignees a ON a.user_id = u.id
         LEFT JOIN tasks t ON t.id = a.task_id AND t.workspace_id = $1 AND t.deleted_at IS NULL AND t.archived_at IS NULL
         WHERE m.workspace_id = $1 AND u.deleted_at IS NULL
         GROUP BY u.id ORDER BY completed DESC, assigned DESC LIMIT 10`,
        [workspaceId, days, tz],
      ),
      activityRepository.list(workspaceId, { projectId: q.projectId, limit: 12 }),
    ]);

    const t = totals.rows[0];
    return {
      totals: {
        projects: t.projects,
        tasks: t.tasks,
        todo: t.todo,
        doing: t.doing,
        done: t.done,
        overdue: t.overdue,
        completionRate: t.tasks ? Math.round((t.done / t.tasks) * 100) : 0,
      },
      series: series.rows,
      upcoming: upcoming.rows.map(toTaskDTO),
      projects: projects.rows.map((p) => ({
        id: p.id,
        name: p.name,
        color: p.color,
        icon: p.icon,
        taskCount: p.task_count,
        doneCount: p.done_count,
        overdueCount: p.overdue_count,
        progress: p.task_count ? Math.round((p.done_count / p.task_count) * 100) : 0,
      })),
      productivity: productivity.rows.map((r) => ({
        user: { id: r.id, name: r.name, avatarUrl: r.avatar_url },
        assigned: r.assigned,
        completed: r.completed,
        overdue: r.overdue,
      })),
      activity: activity.items,
    };
  },

  /** Busca global restrita ao workspace do qual o usuário é membro (já validado no middleware). */
  async search(workspaceId: string, term: string): Promise<SearchResults> {
    const like = `%${normalizeText(term).replace(/[%_\\]/g, "\\$&")}%`;
    const norm = (expr: string) => `translate(lower(${expr}), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn')`;
    const [tasks, projects, members, teams, comments] = await Promise.all([
      db.query<{ id: string; title: string; project_id: string; status: "todo" | "doing" | "done" }>(
        `SELECT t.id, t.title, t.project_id, t.status FROM tasks t
         JOIN projects p ON p.id = t.project_id AND p.deleted_at IS NULL
         WHERE t.workspace_id = $1 AND t.deleted_at IS NULL AND ${norm("t.title || ' ' || coalesce(t.description, '')")} LIKE $2
         ORDER BY t.updated_at DESC LIMIT 8`,
        [workspaceId, like],
      ),
      db.query<{ id: string; name: string; color: string; icon: string }>(
        `SELECT id, name, color, icon FROM projects
         WHERE workspace_id = $1 AND deleted_at IS NULL AND ${norm("name || ' ' || coalesce(description, '')")} LIKE $2 LIMIT 5`,
        [workspaceId, like],
      ),
      db.query<{ id: string; name: string; avatar_url: string | null }>(
        `SELECT u.id, u.name, u.avatar_url FROM workspace_members m JOIN users u ON u.id = m.user_id
         WHERE m.workspace_id = $1 AND u.deleted_at IS NULL AND ${norm("u.name || ' ' || u.email")} LIKE $2 LIMIT 5`,
        [workspaceId, like],
      ),
      db.query<{ id: string; name: string; color: string }>(
        `SELECT id, name, color FROM teams WHERE workspace_id = $1 AND ${norm("name")} LIKE $2 LIMIT 5`,
        [workspaceId, like],
      ),
      db.query<{ id: string; task_id: string; body: string }>(
        `SELECT c.id, c.task_id, c.body FROM comments c JOIN tasks t ON t.id = c.task_id
         WHERE t.workspace_id = $1 AND t.deleted_at IS NULL AND c.deleted_at IS NULL AND ${norm("c.body")} LIKE $2
         ORDER BY c.created_at DESC LIMIT 5`,
        [workspaceId, like],
      ),
    ]);
    return {
      tasks: tasks.rows.map((r) => ({ id: r.id, title: r.title, projectId: r.project_id, status: r.status })),
      projects: projects.rows,
      members: members.rows.map((r) => ({ id: r.id, name: r.name, avatarUrl: r.avatar_url })),
      teams: teams.rows,
      comments: comments.rows.map((r) => ({ id: r.id, taskId: r.task_id, excerpt: r.body.replace(/@\[([^\]]+)\]\([0-9a-f-]{36}\)/gi, "@$1").slice(0, 140) })),
    };
  },
};
