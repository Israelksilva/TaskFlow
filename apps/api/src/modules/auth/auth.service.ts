import type {
  AuthConfig,
  AuthResponse,
  LoginInput,
  LoginResponse,
  RegisterInput,
  ResetPasswordInput,
  User,
} from "@andamo/shared";
import { db } from "../../db";
import { DUMMY_HASH, hashPassword, needsRehash, verifyPassword } from "../../lib/password";
import { logger } from "../../lib/logger";
import { ConflictError, TooManyRequestsError, UnauthorizedError, ValidationError } from "../../shared/errors";
import { mailer, sendMail } from "../mail/mailer";
import { resetPasswordMail, securityNoticeMail, verifyEmailMail } from "../mail/templates";
import { getGoogleProvider } from "../google/google.provider";
import { type ClientMeta, sessionService } from "../sessions/session.service";
import { sessionRepository } from "../sessions/session.repository";
import { toUserDTO } from "../users/user.mapper";
import { type UserRow, userRepository } from "../users/user.repository";
import { authTokens } from "./auth-token.repository";
import { loginThrottle } from "./login-throttle";
import { twoFactorService } from "./two-factor.service";

const MINUTE = 60_000;
const VERIFY_TTL = 24 * 60 * MINUTE;
const RESET_TTL = 30 * MINUTE;
const MFA_TTL = 5 * MINUTE;
const MFA_MAX_ATTEMPTS = 5;

interface MfaPayload {
  remember: boolean;
  attempts: number;
}

async function sendVerification(user: UserRow) {
  await authTokens.revokeAll(user.id, "verify_email");
  const token = await authTokens.issue("verify_email", VERIFY_TTL, { userId: user.id });
  await sendMail(verifyEmailMail(user.email, user.name, token));
}

/** Depois da senha (ou do Google): abre a sessão ou pede o código do 2FA. */
export async function completeLogin(user: UserRow, remember: boolean, meta: ClientMeta): Promise<LoginResponse> {
  if (user.totp_enabled_at) {
    const mfaToken = await authTokens.issue("mfa_challenge", MFA_TTL, {
      userId: user.id,
      payload: { remember, attempts: 0 } satisfies MfaPayload,
    });
    return { mfaRequired: true, mfaToken };
  }
  return sessionService.open(user, remember, meta);
}

export const authService = {
  config(): AuthConfig {
    // Em dev/teste o e-mail "chega" (arquivo local ou memória); em produção, só com Resend.
    return { emailEnabled: mailer.name !== "disabled", googleEnabled: Boolean(getGoogleProvider()) };
  },

  async register(input: RegisterInput, meta: ClientMeta): Promise<AuthResponse> {
    // O cadastro precisa dizer que o e-mail já existe (senão a pessoa não entende por que não entrou);
    // a enumeração aqui é contida pelo limite por IP. Login e recuperação não revelam (S-04).
    const existing = await userRepository.findByEmail(input.email);
    if (existing) throw new ConflictError("Este e-mail já está cadastrado", "EMAIL_IN_USE");

    const passwordHash = await hashPassword(input.password);
    const user = await userRepository.create({ name: input.name, email: input.email, passwordHash });
    await sendVerification(user);
    return sessionService.open(user, input.remember, meta);
  },

  async login(input: LoginInput, meta: ClientMeta): Promise<LoginResponse> {
    await loginThrottle.assertAllowed(input.email);
    const user = await userRepository.findByEmail(input.email);
    // Sempre compara um hash para não revelar (pelo tempo de resposta) se o e-mail existe.
    const valid = await verifyPassword(input.password, user?.password_hash ?? DUMMY_HASH);

    if (!user || !user.password_hash || !valid) {
      await loginThrottle.registerFailure(input.email);
      throw new UnauthorizedError("E-mail ou senha inválidos", "INVALID_CREDENTIALS");
    }

    await loginThrottle.reset(input.email);
    if (needsRehash(user.password_hash)) {
      await userRepository.update(user.id, { passwordHash: await hashPassword(input.password) });
    }
    return completeLogin(user, input.remember, meta);
  },

  async loginWithTwoFactor(mfaToken: string, code: string, meta: ClientMeta): Promise<AuthResponse> {
    const challenge = await authTokens.peek<MfaPayload>(mfaToken, "mfa_challenge");
    if (!challenge?.userId) {
      throw new UnauthorizedError("A verificação expirou. Entre novamente.", "MFA_EXPIRED");
    }
    const user = await userRepository.findById(challenge.userId);
    if (!user?.totp_enabled_at) throw new UnauthorizedError("A verificação expirou. Entre novamente.", "MFA_EXPIRED");

    if (!(await twoFactorService.verifyCode(user, code))) {
      const attempts = (challenge.payload.attempts ?? 0) + 1;
      if (attempts >= MFA_MAX_ATTEMPTS) {
        await authTokens.markUsed(challenge.id);
        throw new TooManyRequestsError("Muitas tentativas. Entre novamente.", "MFA_LOCKED");
      }
      await authTokens.updatePayload(challenge.id, { ...challenge.payload, attempts });
      throw new ValidationError({ code: ["Código inválido"] }, "Código inválido");
    }
    // Consome o desafio; se outro pedido já o usou, não abre uma segunda sessão.
    if (!(await authTokens.consume(mfaToken, "mfa_challenge"))) {
      throw new UnauthorizedError("A verificação expirou. Entre novamente.", "MFA_EXPIRED");
    }
    return sessionService.open(user, challenge.payload.remember, meta);
  },

  refresh: (refreshToken: string, meta: ClientMeta) => sessionService.refresh(refreshToken, meta),

  async logout(userId: string, sessionId: string) {
    await sessionRepository.revoke(userId, sessionId, "logout");
  },

  async me(userId: string): Promise<User> {
    const user = await userRepository.findById(userId);
    if (!user) throw new UnauthorizedError("Usuário não encontrado", "USER_NOT_FOUND");
    return toUserDTO(user);
  },

  async verifyEmail(token: string): Promise<User> {
    const record = await authTokens.consume(token, "verify_email");
    if (!record?.userId) {
      throw new ValidationError({ token: ["Link inválido ou expirado"] }, "Link inválido ou expirado. Peça um novo.");
    }
    const user = await userRepository.update(record.userId, { emailVerifiedAt: new Date().toISOString() });
    return toUserDTO(user);
  },

  async resendVerification(userId: string) {
    const user = await userRepository.findById(userId);
    if (!user || user.email_verified_at) return;
    await sendVerification(user);
  },

  /** Sempre responde igual, exista ou não a conta (S-04). */
  async forgotPassword(email: string) {
    const user = await userRepository.findByEmail(email);
    if (!user) return;
    const send = async () => {
      await authTokens.revokeAll(user.id, "reset_password");
      const token = await authTokens.issue("reset_password", RESET_TTL, { userId: user.id });
      await sendMail(resetPasswordMail(user.email, user.name, token));
    };
    // Sem esperar o envio: o tempo de resposta não revela se a conta existe.
    // Temporário até o outbox (Fase 6).
    void send().catch((err) => logger.error({ err }, "Falha ao preparar redefinição de senha"));
  },

  async resetPassword({ token, password }: ResetPasswordInput) {
    const record = await authTokens.consume(token, "reset_password");
    if (!record?.userId) {
      throw new ValidationError({ token: ["Link inválido ou expirado"] }, "Link inválido ou expirado. Peça um novo.");
    }
    const passwordHash = await hashPassword(password);
    const user = await db.transaction(async (tx) => {
      const current = await userRepository.findById(record.userId!, tx);
      const updated = await userRepository.update(
        record.userId!,
        {
          passwordHash,
          passwordChangedAt: new Date().toISOString(),
          // Quem abriu o link provou ser dono do e-mail.
          emailVerifiedAt: current?.email_verified_at ?? new Date().toISOString(),
        },
        tx,
      );
      await sessionRepository.revokeAll(record.userId!, "password_reset", null, tx);
      await authTokens.revokeAll(record.userId!, "reset_password", tx);
      return updated;
    });
    await loginThrottle.reset(user.email);
    await sendMail(securityNoticeMail(user.email, user.name, "password_changed"));
  },
};
