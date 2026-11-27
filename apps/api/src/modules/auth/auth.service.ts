import type { AuthResponse, LoginInput, LoginResponse, RegisterInput, UpdateProfileInput, User } from "@andamo/shared";
import { env } from "../../config/env";
import { db, type Queryable } from "../../db";
import { decrypt, encrypt, randomToken, sha256 } from "../../lib/crypto";
import { DUMMY_HASH, hashPassword, verifyPassword } from "../../lib/password";
import { generateSecret, otpauthUrl, verifyCode } from "../../lib/totp";
import { BadRequestError, ConflictError, ForbiddenError, TooManyRequestsError, UnauthorizedError } from "../../shared/errors";
import { audit } from "../audit/audit";
import { queueEmail } from "../email/email.service";
import { emailTemplates } from "../email/templates";
import { toUserDTO } from "../users/user.mapper";
import { userRepository, type UserRow } from "../users/user.repository";
import { workspaceRepository } from "../workspaces/workspace.repository";
import { sessionService } from "./session.service";

type Client = { ip: string | null; userAgent: string | null };
type TokenPurpose = "verify_email" | "reset_password" | "mfa_challenge";

const TOKEN_TTL_MINUTES: Record<TokenPurpose, number> = {
  verify_email: 48 * 60,
  reset_password: 60,
  mfa_challenge: 5,
};

async function issueToken(userId: string, purpose: TokenPurpose, tx: Queryable = db): Promise<string> {
  const token = randomToken(32);
  // Só o último token de cada finalidade vale.
  await tx.query(`UPDATE auth_tokens SET used_at = now() WHERE user_id = $1 AND purpose = $2 AND used_at IS NULL`, [userId, purpose]);
  await tx.query(
    `INSERT INTO auth_tokens (user_id, purpose, token_hash, expires_at)
     VALUES ($1, $2, $3, now() + make_interval(mins => $4))`,
    [userId, purpose, sha256(token), TOKEN_TTL_MINUTES[purpose]],
  );
  return token;
}

/** Consome um token de uso único (atômico: dois usos simultâneos não passam). */
async function consumeToken(token: string, purpose: TokenPurpose, tx: Queryable = db): Promise<string | null> {
  const { rows } = await tx.query<{ user_id: string }>(
    `UPDATE auth_tokens SET used_at = now()
     WHERE token_hash = $1 AND purpose = $2 AND used_at IS NULL AND expires_at > now()
     RETURNING user_id`,
    [sha256(token), purpose],
  );
  return rows[0]?.user_id ?? null;
}

async function respond(user: UserRow, client: Client, tx: Queryable = db): Promise<AuthResponse> {
  // Checado só depois da credencial válida: não revela a terceiros que a conta está suspensa.
  if (user.suspended_at) throw new ForbiddenError("Esta conta está suspensa. Fale com o suporte do Andamo.", "ACCOUNT_SUSPENDED");
  const { sessionId: _sid, ...tokens } = await sessionService.create(user.id, client, tx);
  return { user: toUserDTO(user), ...tokens };
}

async function sendVerification(user: UserRow) {
  const token = await issueToken(user.id, "verify_email");
  await queueEmail(user.email, emailTemplates.verifyEmail(user.name.split(" ")[0], token), { userId: user.id });
}

async function assertNotLocked(user: UserRow) {
  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    throw new TooManyRequestsError("Muitas tentativas de login. Sua conta foi bloqueada por 15 minutos.");
  }
}

interface GoogleTokenInfo {
  aud: string;
  sub: string;
  email: string;
  email_verified: string | boolean;
  name?: string;
  picture?: string;
}

export const authService = {
  async register(input: RegisterInput, client: Client): Promise<AuthResponse> {
    const existing = await userRepository.findByEmail(input.email);
    if (existing) throw new ConflictError("Este e-mail já está cadastrado", "EMAIL_IN_USE");

    const passwordHash = await hashPassword(input.password);
    const result = await db.transaction(async (tx) => {
      const user = await userRepository.create({ name: input.name, email: input.email, passwordHash }, tx);
      await workspaceRepository.createPersonal(user.id, user.name, tx);
      return { user, response: await respond(user, client, tx) };
    });
    await sendVerification(result.user);
    return result.response;
  },

  async login(input: LoginInput, client: Client): Promise<LoginResponse> {
    const user = await userRepository.findByEmail(input.email);
    if (user) await assertNotLocked(user);
    // Sempre compara um hash para não revelar (pelo tempo de resposta) se o e-mail existe.
    const valid = await verifyPassword(input.password, user?.password_hash ?? DUMMY_HASH);

    if (!user || !user.password_hash || !valid) {
      if (user) await userRepository.registerFailedLogin(user.id);
      throw new UnauthorizedError("E-mail ou senha inválidos", "INVALID_CREDENTIALS");
    }

    if (user.totp_enabled_at) {
      return { mfaRequired: true, mfaToken: await issueToken(user.id, "mfa_challenge") };
    }
    await userRepository.registerSuccessfulLogin(user.id);
    await audit({ actorId: user.id, action: "auth.login", ip: client.ip });
    return respond(user, client);
  },

  async loginWithMfa(mfaToken: string, code: string, client: Client): Promise<AuthResponse> {
    const { rows } = await db.query<{ user_id: string }>(
      `SELECT user_id FROM auth_tokens WHERE token_hash = $1 AND purpose = 'mfa_challenge' AND used_at IS NULL AND expires_at > now()`,
      [sha256(mfaToken)],
    );
    const user = rows[0] ? await userRepository.findById(rows[0].user_id) : null;
    if (!user?.totp_secret) throw new UnauthorizedError("Desafio expirado. Faça login novamente.", "MFA_EXPIRED");
    await assertNotLocked(user);

    if (!verifyCode(decrypt(user.totp_secret), code)) {
      await userRepository.registerFailedLogin(user.id);
      throw new UnauthorizedError("Código inválido", "INVALID_MFA_CODE");
    }
    if (!(await consumeToken(mfaToken, "mfa_challenge"))) {
      throw new UnauthorizedError("Desafio expirado. Faça login novamente.", "MFA_EXPIRED");
    }
    await userRepository.registerSuccessfulLogin(user.id);
    await audit({ actorId: user.id, action: "auth.login_mfa", ip: client.ip });
    return respond(user, client);
  },

  /** Login com Google (ID token do Google Identity Services, validado no servidor). */
  async loginWithGoogle(credential: string, client: Client): Promise<AuthResponse> {
    if (!env.GOOGLE_CLIENT_ID) throw new BadRequestError("Login com Google não está configurado", "GOOGLE_DISABLED");
    const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`, {
      signal: AbortSignal.timeout(10_000),
    });
    const info = (await res.json().catch(() => null)) as GoogleTokenInfo | null;
    const verified = info?.email_verified === true || info?.email_verified === "true";
    if (!res.ok || !info || info.aud !== env.GOOGLE_CLIENT_ID || !verified) {
      throw new UnauthorizedError("Não foi possível validar a conta Google", "GOOGLE_INVALID");
    }
    const email = info.email.toLowerCase();

    const user = await db.transaction(async (tx) => {
      const bySub = await userRepository.findByGoogleSub(info.sub, tx);
      if (bySub) return bySub;
      const byEmail = await userRepository.findByEmail(email, tx);
      if (byEmail) {
        // O Google confirmou a posse do e-mail: vincula a conta existente.
        return userRepository.update(byEmail.id, { googleSub: info.sub, emailVerifiedAt: byEmail.email_verified_at ?? new Date() }, tx);
      }
      const created = await userRepository.create(
        { name: (info.name ?? email.split("@")[0]).slice(0, 80), email, passwordHash: null, googleSub: info.sub, emailVerified: true },
        tx,
      );
      await workspaceRepository.createPersonal(created.id, created.name, tx);
      return created;
    });
    await assertNotLocked(user);
    await userRepository.registerSuccessfulLogin(user.id);
    await audit({ actorId: user.id, action: "auth.login_google", ip: client.ip });
    return respond(user, client);
  },

  async refresh(refreshToken: string, client: Client): Promise<AuthResponse> {
    const { userId, tokens } = await sessionService.refresh(refreshToken, client);
    const user = await userRepository.findById(userId);
    if (!user) throw new UnauthorizedError("Usuário não encontrado", "USER_NOT_FOUND");
    if (user.suspended_at) {
      await sessionService.revoke(userId, tokens.sessionId);
      throw new UnauthorizedError("Esta conta está suspensa. Fale com o suporte.", "ACCOUNT_SUSPENDED");
    }
    const { sessionId: _sid, ...rest } = tokens;
    return { user: toUserDTO(user), ...rest };
  },

  async logout(userId: string, sessionId: string) {
    await sessionService.revoke(userId, sessionId);
  },

  async me(userId: string): Promise<User> {
    const user = await userRepository.findById(userId);
    if (!user) throw new UnauthorizedError("Usuário não encontrado", "USER_NOT_FOUND");
    return toUserDTO(user);
  },

  async resendVerification(userId: string) {
    const user = await userRepository.findById(userId);
    if (!user || user.email_verified_at) return;
    const { rows } = await db.query<{ recent: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM auth_tokens WHERE user_id = $1 AND purpose = 'verify_email'
         AND created_at > now() - interval '60 seconds') AS recent`,
      [userId],
    );
    if (rows[0].recent) throw new TooManyRequestsError("Aguarde um minuto antes de reenviar o e-mail.");
    await sendVerification(user);
  },

  async verifyEmail(token: string): Promise<void> {
    const userId = await consumeToken(token, "verify_email");
    if (!userId) throw new BadRequestError("Link inválido ou expirado", "INVALID_TOKEN");
    await db.query(`UPDATE users SET email_verified_at = COALESCE(email_verified_at, now()) WHERE id = $1`, [userId]);
  },

  /** Resposta idêntica exista ou não o e-mail (não permite descobrir contas). */
  async forgotPassword(email: string): Promise<void> {
    const user = await userRepository.findByEmail(email);
    if (!user) return;
    const token = await issueToken(user.id, "reset_password");
    await queueEmail(user.email, emailTemplates.resetPassword(user.name.split(" ")[0], token), { userId: user.id });
  },

  /** Nova senha encerra todas as sessões (um invasor perde o acesso). */
  async resetPassword(token: string, password: string, client: Client): Promise<void> {
    const passwordHash = await hashPassword(password);
    await db.transaction(async (tx) => {
      const userId = await consumeToken(token, "reset_password", tx);
      if (!userId) throw new BadRequestError("Link inválido ou expirado", "INVALID_TOKEN");
      await tx.query(
        `UPDATE users SET password_hash = $2, failed_login_count = 0, locked_until = NULL,
           email_verified_at = COALESCE(email_verified_at, now()), updated_at = now() WHERE id = $1`,
        [userId, passwordHash],
      );
      await sessionService.revokeAll(userId, null, tx);
      await audit({ actorId: userId, action: "auth.password_reset", ip: client.ip }, tx);
    });
  },

  async changePassword(userId: string, sessionId: string, current: string | undefined, next: string, client: Client) {
    const user = await userRepository.findById(userId);
    if (!user) throw new UnauthorizedError();
    if (user.password_hash && !(current && (await verifyPassword(current, user.password_hash)))) {
      throw new BadRequestError("Senha atual incorreta", "INVALID_PASSWORD");
    }
    await userRepository.update(userId, { passwordHash: await hashPassword(next) });
    await sessionService.revokeAll(userId, sessionId);
    await audit({ actorId: userId, action: "auth.password_changed", ip: client.ip });
  },

  async updateProfile(userId: string, input: UpdateProfileInput): Promise<User> {
    return toUserDTO(await userRepository.update(userId, input));
  },

  async completeOnboarding(userId: string): Promise<User> {
    return toUserDTO(await userRepository.update(userId, { onboardedAt: new Date() }));
  },

  // ------------------------------------------------------------ 2FA (TOTP)
  async setupTwoFactor(userId: string) {
    const user = await userRepository.findById(userId);
    if (!user) throw new UnauthorizedError();
    if (user.totp_enabled_at) throw new ConflictError("A verificação em duas etapas já está ativa", "MFA_ALREADY_ENABLED");
    const secret = generateSecret();
    await userRepository.update(userId, { totpSecret: encrypt(secret) });
    return { secret, otpauthUrl: otpauthUrl(secret, user.email) };
  },

  async enableTwoFactor(userId: string, code: string, client: Client): Promise<User> {
    const user = await userRepository.findById(userId);
    if (!user?.totp_secret) throw new BadRequestError("Inicie a configuração novamente", "MFA_NOT_STARTED");
    if (!verifyCode(decrypt(user.totp_secret), code)) throw new BadRequestError("Código inválido", "INVALID_MFA_CODE");
    const updated = await userRepository.update(userId, { totpEnabledAt: new Date() });
    await audit({ actorId: userId, action: "auth.mfa_enabled", ip: client.ip });
    return toUserDTO(updated);
  },

  async disableTwoFactor(userId: string, code: string, client: Client): Promise<User> {
    const user = await userRepository.findById(userId);
    if (!user?.totp_secret || !user.totp_enabled_at) throw new BadRequestError("A verificação em duas etapas não está ativa");
    if (!verifyCode(decrypt(user.totp_secret), code)) throw new BadRequestError("Código inválido", "INVALID_MFA_CODE");
    const updated = await userRepository.update(userId, { totpSecret: null, totpEnabledAt: null });
    await audit({ actorId: userId, action: "auth.mfa_disabled", ip: client.ip });
    return toUserDTO(updated);
  },

  // ------------------------------------------------------------ LGPD
  /** Portabilidade: tudo o que pertence ao usuário, em JSON. */
  async exportData(userId: string) {
    const user = await this.me(userId);
    const q = async (sql: string) => (await db.query(sql, [userId])).rows;
    return {
      exportedAt: new Date().toISOString(),
      user,
      workspaces: await q(`SELECT w.id, w.name, m.role, m.joined_at FROM workspace_members m JOIN workspaces w ON w.id = m.workspace_id WHERE m.user_id = $1`),
      tasksCreated: await q(`SELECT id, workspace_id, project_id, title, description, status, priority, due_date::text, created_at FROM tasks WHERE user_id = $1`),
      tasksAssigned: await q(`SELECT t.id, t.title, t.status FROM task_assignees a JOIN tasks t ON t.id = a.task_id WHERE a.user_id = $1`),
      comments: await q(`SELECT id, task_id, body, created_at FROM comments WHERE author_id = $1 AND deleted_at IS NULL`),
      notifications: await q(`SELECT type, title, body, created_at, read_at FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1000`),
      sessions: await q(`SELECT user_agent, ip, created_at, last_used_at FROM sessions WHERE user_id = $1`),
    };
  },

  /**
   * Exclusão de conta: remove workspaces dos quais é o único membro; se for dono de um
   * workspace com outras pessoas, exige transferir a propriedade antes.
   */
  async deleteAccount(userId: string, password: string | undefined, client: Client) {
    const user = await userRepository.findById(userId);
    if (!user) throw new UnauthorizedError();
    if (user.password_hash && !(password && (await verifyPassword(password, user.password_hash)))) {
      throw new BadRequestError("Senha incorreta", "INVALID_PASSWORD");
    }
    const { rows: shared } = await db.query<{ name: string }>(
      `SELECT w.name FROM workspaces w WHERE w.owner_id = $1
         AND EXISTS (SELECT 1 FROM workspace_members m WHERE m.workspace_id = w.id AND m.user_id <> $1)`,
      [userId],
    );
    if (shared.length) {
      throw new ConflictError(
        `Transfira a propriedade de "${shared[0].name}" antes de excluir sua conta`,
        "OWNS_SHARED_WORKSPACE",
      );
    }
    await db.transaction(async (tx) => {
      await tx.query(`DELETE FROM workspaces WHERE owner_id = $1`, [userId]);
      await audit({ actorId: null, action: "auth.account_deleted", target: userId, ip: client.ip }, tx);
      await tx.query(`DELETE FROM users WHERE id = $1`, [userId]);
    });
  },
};
