import { db as defaultDb, type Queryable } from "../../db";

export interface UserRow {
  id: string;
  name: string;
  email: string;
  password_hash: string | null;
  created_at: Date | string;
  email_verified_at: Date | string | null;
  password_changed_at: Date | string | null;
  totp_secret: string | null;
  totp_enabled_at: Date | string | null;
  totp_last_counter: string | number | null;
  google_sub: string | null;
  locale: string;
  timezone: string;
}

const COLUMNS =
  "id, name, email, password_hash, created_at, email_verified_at, password_changed_at, totp_secret, totp_enabled_at, totp_last_counter, google_sub, locale, timezone";

/** Colunas que `update` aceita (lista fixa: nomes nunca vêm do cliente). */
const UPDATABLE = {
  name: "name",
  passwordHash: "password_hash",
  emailVerifiedAt: "email_verified_at",
  passwordChangedAt: "password_changed_at",
  totpSecret: "totp_secret",
  totpEnabledAt: "totp_enabled_at",
  totpLastCounter: "totp_last_counter",
  googleSub: "google_sub",
  locale: "locale",
  timezone: "timezone",
} as const;

export type UserUpdate = Partial<Record<keyof typeof UPDATABLE, unknown>>;

export const userRepository = {
  async findById(id: string, db: Queryable = defaultDb): Promise<UserRow | null> {
    const { rows } = await db.query<UserRow>(`SELECT ${COLUMNS} FROM users WHERE id = $1`, [id]);
    return rows[0] ?? null;
  },

  async findByEmail(email: string, db: Queryable = defaultDb): Promise<UserRow | null> {
    const { rows } = await db.query<UserRow>(`SELECT ${COLUMNS} FROM users WHERE email = $1`, [email]);
    return rows[0] ?? null;
  },

  async findByGoogleSub(sub: string, db: Queryable = defaultDb): Promise<UserRow | null> {
    const { rows } = await db.query<UserRow>(`SELECT ${COLUMNS} FROM users WHERE google_sub = $1`, [sub]);
    return rows[0] ?? null;
  },

  async create(
    data: { name: string; email: string; passwordHash: string | null; googleSub?: string; emailVerified?: boolean },
    db: Queryable = defaultDb,
  ): Promise<UserRow> {
    const { rows } = await db.query<UserRow>(
      `INSERT INTO users (name, email, password_hash, google_sub, email_verified_at, password_changed_at)
       VALUES ($1, $2, $3, $4, CASE WHEN $5::boolean THEN now() END, CASE WHEN $3::text IS NOT NULL THEN now() END)
       RETURNING ${COLUMNS}`,
      [data.name, data.email, data.passwordHash, data.googleSub ?? null, data.emailVerified ?? false],
    );
    return rows[0];
  },

  async update(id: string, data: UserUpdate, db: Queryable = defaultDb): Promise<UserRow> {
    const entries = Object.entries(data).filter(([, v]) => v !== undefined) as [keyof typeof UPDATABLE, unknown][];
    if (!entries.length) return (await this.findById(id, db))!;
    const sets = entries.map(([k], i) => `${UPDATABLE[k]} = $${i + 2}`);
    const { rows } = await db.query<UserRow>(
      `UPDATE users SET ${sets.join(", ")}, updated_at = now() WHERE id = $1 RETURNING ${COLUMNS}`,
      [id, ...entries.map(([, v]) => v)],
    );
    return rows[0];
  },
};
