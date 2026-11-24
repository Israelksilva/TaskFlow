import type { User } from "@andamo/shared";
import { toISO } from "../../shared/dates";
import type { UserRow } from "./user.repository";

/** Nunca expõe `password_hash`. */
export function toUserDTO(user: UserRow): User {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: toISO(user.created_at),
  };
}
