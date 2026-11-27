import type { ChangePasswordInput, SessionInfo, UpdateProfileInput, User } from "@andamo/shared";
import { db } from "../../db";
import { hashPassword, verifyPassword } from "../../lib/password";
import { NotFoundError, UnauthorizedError, ValidationError } from "../../shared/errors";
import { sendMail } from "../mail/mailer";
import { securityNoticeMail } from "../mail/templates";
import { sessionRepository, toSessionDTO } from "../sessions/session.repository";
import { toUserDTO } from "../users/user.mapper";
import { userRepository } from "../users/user.repository";

export const accountService = {
  async updateProfile(userId: string, input: UpdateProfileInput): Promise<User> {
    return toUserDTO(await userRepository.update(userId, input));
  },

  /** Troca (ou define, em conta só com Google) a senha e encerra as outras sessões. */
  async changePassword(userId: string, sessionId: string, input: ChangePasswordInput): Promise<User> {
    const user = await userRepository.findById(userId);
    if (!user) throw new UnauthorizedError();
    if (user.password_hash) {
      const ok = input.currentPassword && (await verifyPassword(input.currentPassword, user.password_hash));
      if (!ok) throw new ValidationError({ currentPassword: ["Senha atual incorreta"] }, "Senha atual incorreta");
    }
    const passwordHash = await hashPassword(input.newPassword);
    const updated = await db.transaction(async (tx) => {
      const row = await userRepository.update(userId, { passwordHash, passwordChangedAt: new Date().toISOString() }, tx);
      await sessionRepository.revokeAll(userId, "password_changed", sessionId, tx);
      return row;
    });
    await sendMail(securityNoticeMail(user.email, user.name, "password_changed"));
    return toUserDTO(updated);
  },

  async listSessions(userId: string, currentId: string): Promise<SessionInfo[]> {
    return (await sessionRepository.listActive(userId)).map((s) => toSessionDTO(s, currentId));
  },

  async revokeSession(userId: string, id: string) {
    if (!/^[0-9a-f-]{36}$/i.test(id) || !(await sessionRepository.revoke(userId, id, "user"))) {
      throw new NotFoundError("Sessão");
    }
  },

  revokeOtherSessions: (userId: string, currentId: string) =>
    sessionRepository.revokeAll(userId, "user_others", currentId),
};
