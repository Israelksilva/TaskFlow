import { db as defaultDb, type Queryable } from "../../db";

export interface UserRow {
  id: string;
  name: string;
  email: string;
  password_hash: string | null;
  avatar_url: string | null;
  email_verified_at: Date | string | null;
  locale: string;
  timezone: string;
  is_platform_admin: boolean;
  google_sub: string | null;
  totp_secret: string | null;
  totp_enabled_at: Date | string | null;
  onboarded_at: Date | string | null;
  failed_login_count: number;
  locked_until: Date | string | null;
  created_at: Date | string;
}

const COLUMNS = `id, name, email, password_hash, avatar_url, email_verified_at, locale, timezone,
  is_platform_admin, google_sub, totp_secret, totp_enabled_at, onboarded_at,
  failed_login_count, locked_until, created_at`;

/** Campos de perfil editáveis: nomes de coluna vêm desta lista fixa, nunca do cliente. */
const EDITABLE = {
  name: "name",
  avatarUrl: "avatar_url",
  locale: "locale",
  timezone: "timezone",
  passwordHash: "password_hash",
  totpSecret: "totp_secret",
  totpEnabledAt: "totp_enabled_at",
  emailVerifiedAt: "email_verified_at",
  onboardedAt: "onboarded_at",
  googleSub: "google_sub",
} as const;

export type UserChanges = Partial<Record<keyof typeof EDITABLE, unknown>>;

export const userRepository = {
  async findById(id: string, db: Queryable = defaultDb): Promise<UserRow | null> {
    const { rows } = await db.query<UserRow>(
      `SELECT ${COLUMNS} FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
    return rows[0] ?? null;
  },

  async findByEmail(email: string, db: Queryable = defaultDb): Promise<UserRow | null> {
    const { rows } = await db.query<UserRow>(
      `SELECT ${COLUMNS} FROM users WHERE email = $1 AND deleted_at IS NULL`,
      [email],
    );
    return rows[0] ?? null;
  },

  async findByGoogleSub(sub: string, db: Queryable = defaultDb): Promise<UserRow | null> {
    const { rows } = await db.query<UserRow>(
      `SELECT ${COLUMNS} FROM users WHERE google_sub = $1 AND deleted_at IS NULL`,
      [sub],
    );
    return rows[0] ?? null;
  },

  async create(
    data: { name: string; email: string; passwordHash: string | null; googleSub?: string; emailVerified?: boolean },
    db: Queryable = defaultDb,
  ): Promise<UserRow> {
    const { rows } = await db.query<UserRow>(
      `INSERT INTO users (name, email, password_hash, google_sub, email_verified_at)
       VALUES ($1, $2, $3, $4, CASE WHEN $5 THEN now() END) RETURNING ${COLUMNS}`,
      [data.name, data.email, data.passwordHash, data.googleSub ?? null, data.emailVerified ?? false],
    );
    return rows[0];
  },

  async update(id: string, changes: UserChanges, db: Queryable = defaultDb): Promise<UserRow> {
    const sets: string[] = [];
    const params: unknown[] = [];
    for (const [key, column] of Object.entries(EDITABLE)) {
      const value = changes[key as keyof UserChanges];
      if (value === undefined) continue;
      params.push(value);
      sets.push(`${column} = $${params.length}`);
    }
    sets.push("updated_at = now()");
    params.push(id);
    const { rows } = await db.query<UserRow>(
      `UPDATE users SET ${sets.join(", ")} WHERE id = $${params.length} RETURNING ${COLUMNS}`,
      params,
    );
    return rows[0];
  },

  /** Força bruta: conta falhas e bloqueia por 15 min a partir da 5ª tentativa seguida. */
  async registerFailedLogin(id: string, db: Queryable = defaultDb): Promise<void> {
    await db.query(
      `UPDATE users SET failed_login_count = failed_login_count + 1,
         locked_until = CASE WHEN failed_login_count + 1 >= 5 THEN now() + interval '15 minutes' ELSE locked_until END
       WHERE id = $1`,
      [id],
    );
  },

  async registerSuccessfulLogin(id: string, db: Queryable = defaultDb): Promise<void> {
    await db.query(
      `UPDATE users SET failed_login_count = 0, locked_until = NULL, last_login_at = now() WHERE id = $1`,
      [id],
    );
  },
};
