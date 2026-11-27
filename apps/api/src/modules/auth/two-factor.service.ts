import { randomBytes } from "node:crypto";
import { db, type Queryable } from "../../db";
import { decrypt, encrypt, sha256 } from "../../lib/crypto";
import { generateTotpSecret, otpauthUrl, verifyTotp } from "../../lib/totp";
import { ConflictError, UnauthorizedError, ValidationError } from "../../shared/errors";

/** 422 (e não 401): o usuário está logado; só o código está errado. */
const invalidCode = (message = "Código inválido") => new ValidationError({ code: [message] }, message);
import { sendMail } from "../mail/mailer";
import { securityNoticeMail } from "../mail/templates";
import { toUserDTO } from "../users/user.mapper";
import { type UserRow, userRepository } from "../users/user.repository";

const RECOVERY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem 0/O, 1/I
const RECOVERY_COUNT = 10;

function recoveryCode() {
  const bytes = randomBytes(10);
  const chars = [...bytes].map((b) => RECOVERY_ALPHABET[b % RECOVERY_ALPHABET.length]).join("");
  return `${chars.slice(0, 5)}-${chars.slice(5)}`;
}

async function replaceRecoveryCodes(userId: string, tx: Queryable): Promise<string[]> {
  const codes = Array.from({ length: RECOVERY_COUNT }, recoveryCode);
  await tx.query("DELETE FROM recovery_codes WHERE user_id = $1", [userId]);
  for (const code of codes) {
    await tx.query("INSERT INTO recovery_codes (user_id, code_hash) VALUES ($1, $2)", [userId, sha256(code)]);
  }
  return codes;
}

export const twoFactorService = {
  /**
   * Confere um código do app (sem permitir reutilizar o mesmo código) ou um código de recuperação
   * (que é consumido). Retorna `true` se válido.
   */
  async verifyCode(user: UserRow, code: string, { allowRecovery = true } = {}): Promise<boolean> {
    if (!user.totp_secret) return false;
    if (/^\d{6}$/.test(code)) {
      const counter = verifyTotp(decrypt(user.totp_secret), code);
      if (counter === null) return false;
      // Atômico: o mesmo código (ou um anterior) não vale duas vezes.
      const { rows } = await db.query(
        `UPDATE users SET totp_last_counter = $2
          WHERE id = $1 AND (totp_last_counter IS NULL OR totp_last_counter < $2) RETURNING id`,
        [user.id, counter],
      );
      return rows.length > 0;
    }
    if (!allowRecovery) return false;
    const { rows } = await db.query(
      `UPDATE recovery_codes SET used_at = now()
        WHERE id = (SELECT id FROM recovery_codes WHERE user_id = $1 AND code_hash = $2 AND used_at IS NULL LIMIT 1)
        RETURNING id`,
      [user.id, sha256(code)],
    );
    return rows.length > 0;
  },

  async remainingRecoveryCodes(userId: string) {
    const { rows } = await db.query<{ n: number | string }>(
      "SELECT count(*) AS n FROM recovery_codes WHERE user_id = $1 AND used_at IS NULL",
      [userId],
    );
    return Number(rows[0]?.n ?? 0);
  },

  /** Passo 1: gera um segredo pendente (ainda não ativo). */
  async setup(userId: string) {
    const user = await userRepository.findById(userId);
    if (!user) throw new UnauthorizedError();
    if (user.totp_enabled_at) throw new ConflictError("A verificação em duas etapas já está ativa", "TWO_FACTOR_ENABLED");
    const secret = generateTotpSecret();
    await userRepository.update(userId, { totpSecret: encrypt(secret), totpLastCounter: null });
    return { secret, otpauthUrl: otpauthUrl(secret, user.email) };
  },

  /** Passo 2: confirma com um código do app; devolve os códigos de recuperação (mostrados uma vez). */
  async enable(userId: string, code: string) {
    const user = await userRepository.findById(userId);
    if (!user) throw new UnauthorizedError();
    if (user.totp_enabled_at) throw new ConflictError("A verificação em duas etapas já está ativa", "TWO_FACTOR_ENABLED");
    if (!user.totp_secret) throw new ConflictError("Gere o QR code antes de ativar", "TWO_FACTOR_NOT_SETUP");
    if (!(await this.verifyCode(user, code, { allowRecovery: false }))) {
      throw invalidCode("Código inválido. Confira o horário do celular e tente de novo.");
    }
    const result = await db.transaction(async (tx) => {
      const updated = await userRepository.update(userId, { totpEnabledAt: new Date().toISOString() }, tx);
      return { user: toUserDTO(updated), recoveryCodes: await replaceRecoveryCodes(userId, tx) };
    });
    await sendMail(securityNoticeMail(user.email, user.name, "2fa_enabled"));
    return result;
  },

  async disable(userId: string, code: string) {
    const user = await userRepository.findById(userId);
    if (!user?.totp_enabled_at) throw new ConflictError("A verificação em duas etapas não está ativa", "TWO_FACTOR_DISABLED");
    if (!(await this.verifyCode(user, code))) throw invalidCode();
    const updated = await db.transaction(async (tx) => {
      await tx.query("DELETE FROM recovery_codes WHERE user_id = $1", [userId]);
      return userRepository.update(userId, { totpSecret: null, totpEnabledAt: null, totpLastCounter: null }, tx);
    });
    await sendMail(securityNoticeMail(user.email, user.name, "2fa_disabled"));
    return toUserDTO(updated);
  },

  async regenerateRecoveryCodes(userId: string, code: string) {
    const user = await userRepository.findById(userId);
    if (!user?.totp_enabled_at) throw new ConflictError("A verificação em duas etapas não está ativa", "TWO_FACTOR_DISABLED");
    if (!(await this.verifyCode(user, code, { allowRecovery: false }))) {
      throw invalidCode();
    }
    return { recoveryCodes: await db.transaction((tx) => replaceRecoveryCodes(userId, tx)) };
  },
};
