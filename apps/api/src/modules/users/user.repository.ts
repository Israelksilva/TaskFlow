import { db as defaultDb, type Queryable } from "../../db";

export interface UserRow {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  created_at: Date | string;
}

const COLUMNS = "id, name, email, password_hash, created_at";

export const userRepository = {
  async findById(id: string, db: Queryable = defaultDb): Promise<UserRow | null> {
    const { rows } = await db.query<UserRow>(`SELECT ${COLUMNS} FROM users WHERE id = $1`, [id]);
    return rows[0] ?? null;
  },

  async findByEmail(email: string, db: Queryable = defaultDb): Promise<UserRow | null> {
    const { rows } = await db.query<UserRow>(`SELECT ${COLUMNS} FROM users WHERE email = $1`, [
      email,
    ]);
    return rows[0] ?? null;
  },

  async create(
    data: { name: string; email: string; passwordHash: string },
    db: Queryable = defaultDb,
  ): Promise<UserRow> {
    const { rows } = await db.query<UserRow>(
      `INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING ${COLUMNS}`,
      [data.name, data.email, data.passwordHash],
    );
    return rows[0];
  },
};
