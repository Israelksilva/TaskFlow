import { DEFAULT_COLUMNS, sortColumns, type BoardColumn, type TaskStatus } from "@andamo/shared";
import { db as defaultDb, type Queryable } from "../../db";

export interface ColumnRow {
  id: string;
  project_id: string;
  name: string;
  category: TaskStatus;
  position: number;
  wip_limit: number | null;
  color: string | null;
}

export const toColumnDTO = (r: ColumnRow): BoardColumn => ({
  id: r.id,
  projectId: r.project_id,
  name: r.name,
  category: r.category,
  position: r.position,
  wipLimit: r.wip_limit,
  color: r.color,
});

export const COLUMN_SELECT = `SELECT id, project_id, name, category, position, wip_limit, color FROM project_columns`;

export const columnRepository = {
  async list(projectId: string, db: Queryable = defaultDb): Promise<BoardColumn[]> {
    const { rows } = await db.query<ColumnRow>(`${COLUMN_SELECT} WHERE project_id = $1 ORDER BY position, created_at`, [projectId]);
    return sortColumns(rows.map(toColumnDTO));
  },

  /** Colunas padrão (A Fazer, Em Progresso, Concluído) de um projeto novo. */
  async createDefaults(projectId: string, db: Queryable = defaultDb): Promise<void> {
    for (const [position, c] of DEFAULT_COLUMNS.entries()) {
      await db.query(`INSERT INTO project_columns (project_id, name, category, position) VALUES ($1, $2, $3, $4)`, [
        projectId,
        c.name,
        c.category,
        position,
      ]);
    }
  },

  /** Copia as colunas de um projeto-modelo e devolve o mapa coluna antiga → nova. */
  async copy(fromProjectId: string, toProjectId: string, db: Queryable): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    for (const c of await this.list(fromProjectId, db)) {
      const { rows } = await db.query<{ id: string }>(
        `INSERT INTO project_columns (project_id, name, category, position, wip_limit, color) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [toProjectId, c.name, c.category, c.position, c.wipLimit, c.color],
      );
      map.set(c.id, rows[0].id);
    }
    return map;
  },
};
