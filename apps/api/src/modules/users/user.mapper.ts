import type { User } from "@andamo/shared";
import { toISO } from "../../shared/dates";
import type { UserRow } from "./user.repository";

/** Nunca expõe hash de senha, segredo de 2FA nem identificadores externos. */
export function toUserDTO(user: UserRow): User {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: toISO(user.created_at),
    emailVerified: Boolean(user.email_verified_at),
    hasPassword: Boolean(user.password_hash),
    twoFactorEnabled: Boolean(user.totp_enabled_at),
    googleLinked: Boolean(user.google_sub),
    locale: user.locale,
    timezone: user.timezone,
  };
}
