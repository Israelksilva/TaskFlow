import type { User, UserSummary } from "@andamo/shared";
import { toISO } from "../../shared/dates";
import type { UserRow } from "./user.repository";

/** Nunca expõe `password_hash`, segredo de 2FA nem contadores internos. */
export function toUserDTO(user: UserRow): User {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: toISO(user.created_at),
    avatarUrl: user.avatar_url,
    emailVerified: Boolean(user.email_verified_at),
    locale: user.locale,
    timezone: user.timezone,
    twoFactorEnabled: Boolean(user.totp_enabled_at),
    onboarded: Boolean(user.onboarded_at),
    hasPassword: Boolean(user.password_hash),
    isPlatformAdmin: user.is_platform_admin,
  };
}

export function toUserSummary(row: { id: string; name: string; avatar_url: string | null }): UserSummary {
  return { id: row.id, name: row.name, avatarUrl: row.avatar_url };
}
