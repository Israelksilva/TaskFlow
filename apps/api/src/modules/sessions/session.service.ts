import type { AuthResponse } from "@andamo/shared";
import type { Queryable } from "../../db";
import { randomToken, sha256 } from "../../lib/crypto";
import { logger } from "../../lib/logger";
import { ACCESS_TOKEN_TTL_SECONDS, signAccessToken } from "../../lib/token";
import { UnauthorizedError } from "../../shared/errors";
import { toUserDTO } from "../users/user.mapper";
import type { UserRow } from "../users/user.repository";
import { userRepository } from "../users/user.repository";
import { sessionRepository } from "./session.repository";

const DAY = 24 * 60 * 60 * 1000;
/** "Manter conectado": 30 dias, renovados a cada uso. Sem ela: até 24 h (o front guarda só na aba). */
const ttl = (remember: boolean) => (remember ? 30 * DAY : DAY);
/** Janela em que reapresentar o refresh anterior é tratado como corrida entre abas, não como roubo. */
const ROTATION_GRACE_MS = 30_000;

export interface ClientMeta {
  userAgent: string | null;
  ip: string | null;
}

export const sessionService = {
  async open(user: UserRow, remember: boolean, meta: ClientMeta, db?: Queryable): Promise<AuthResponse> {
    const refreshToken = randomToken();
    const session = await sessionRepository.create(
      { userId: user.id, tokenHash: sha256(refreshToken), remember, expiresAt: new Date(Date.now() + ttl(remember)), ...meta },
      db,
    );
    return {
      user: toUserDTO(user),
      accessToken: signAccessToken(user.id, session.id),
      refreshToken,
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    };
  },

  async refresh(refreshToken: string, meta: ClientMeta): Promise<AuthResponse> {
    const oldHash = sha256(refreshToken);
    const newToken = randomToken();
    const session = await sessionRepository.rotate(oldHash, { newHash: sha256(newToken), ...meta });

    if (session) {
      const user = await userRepository.findById(session.user_id);
      if (!user) throw new UnauthorizedError("Sessão inválida", "INVALID_REFRESH");
      return {
        user: toUserDTO(user),
        accessToken: signAccessToken(user.id, session.id),
        refreshToken: newToken,
        expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      };
    }

    const reused = await sessionRepository.findByPreviousHash(oldHash);
    if (reused && !reused.revoked_at) {
      const rotatedAt = reused.rotated_at ? new Date(reused.rotated_at).getTime() : 0;
      if (Date.now() - rotatedAt < ROTATION_GRACE_MS) {
        throw new UnauthorizedError("Sessão renovada em outra aba", "SESSION_ROTATED");
      }
      await sessionRepository.revoke(reused.user_id, reused.id, "reuse");
      logger.warn({ sessionId: reused.id, userId: reused.user_id }, "Reuso de refresh token: sessão encerrada");
    }
    throw new UnauthorizedError("Sessão expirada. Faça login novamente.", "INVALID_REFRESH");
  },
};
