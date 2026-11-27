import { db as defaultDb, type Queryable } from "../../db";
import { TooManyRequestsError } from "../../shared/errors";

/**
 * Bloqueio progressivo por e-mail (S-06), igual para contas existentes ou não (S-04):
 * a partir da 5ª falha seguida, espera de 1, 2, 4, 8, 16 e no máximo 30 minutos.
 * O limite por IP continua no `express-rate-limit`.
 */
export const FREE_ATTEMPTS = 5;
const MAX_LOCK_MIN = 30;

export const lockMinutes = (failedCount: number) =>
  failedCount < FREE_ATTEMPTS ? 0 : Math.min(2 ** (failedCount - FREE_ATTEMPTS), MAX_LOCK_MIN);

export const loginThrottle = {
  async assertAllowed(email: string, db: Queryable = defaultDb) {
    const { rows } = await db.query<{ locked_until: Date | string | null }>(
      "SELECT locked_until FROM login_throttle WHERE email = $1",
      [email],
    );
    const until = rows[0]?.locked_until ? new Date(rows[0].locked_until) : null;
    if (until && until.getTime() > Date.now()) {
      const minutes = Math.ceil((until.getTime() - Date.now()) / 60_000);
      throw new TooManyRequestsError(
        `Muitas tentativas para este e-mail. Tente novamente em ${minutes} minuto${minutes > 1 ? "s" : ""}.`,
        "LOGIN_LOCKED",
      );
    }
  },

  async registerFailure(email: string, db: Queryable = defaultDb) {
    const { rows } = await db.query<{ failed_count: number }>(
      `INSERT INTO login_throttle (email, failed_count, last_failed_at) VALUES ($1, 1, now())
       ON CONFLICT (email) DO UPDATE SET failed_count = login_throttle.failed_count + 1, last_failed_at = now()
       RETURNING failed_count`,
      [email],
    );
    const minutes = lockMinutes(rows[0].failed_count);
    if (minutes > 0) {
      await db.query("UPDATE login_throttle SET locked_until = now() + make_interval(mins => $2) WHERE email = $1", [
        email,
        minutes,
      ]);
    }
  },

  async reset(email: string, db: Queryable = defaultDb) {
    await db.query("DELETE FROM login_throttle WHERE email = $1", [email]);
  },
};
