import type { LoginResponse } from "@andamo/shared";
import { randomToken } from "../../lib/crypto";
import { logger } from "../../lib/logger";
import { ConflictError, ServiceUnavailableError, UnauthorizedError } from "../../shared/errors";
import { authTokens } from "../auth/auth-token.repository";
import { completeLogin } from "../auth/auth.service";
import { appLink } from "../mail/templates";
import type { ClientMeta } from "../sessions/session.service";
import { toUserDTO } from "../users/user.mapper";
import { userRepository } from "../users/user.repository";
import { getGoogleProvider, googleRedirectUri, type GoogleProfile } from "./google.provider";

const STATE_TTL = 10 * 60_000;
const EXCHANGE_TTL = 60_000;

interface StatePayload {
  verifier: string;
  mode: "login" | "link";
  remember: boolean;
}

function provider() {
  const p = getGoogleProvider();
  if (!p) throw new ServiceUnavailableError("O login com Google ainda não está disponível", "GOOGLE_DISABLED");
  return p;
}

async function start(payload: Omit<StatePayload, "verifier">, userId: string | null) {
  const p = provider();
  const verifier = randomToken(48);
  const state = await authTokens.issue("oauth_state", STATE_TTL, { userId, payload: { ...payload, verifier } });
  return { url: p.authorizationUrl({ state, codeVerifier: verifier, redirectUri: googleRedirectUri() }) };
}

/** Erros voltam para o front como código na URL (sem detalhes sensíveis). */
const loginError = (reason: string) => appLink("/entrar", { erro: `google_${reason}` });
const linkResult = (result: string) => appLink("/app/configuracoes", { aba: "seguranca", google: result });

async function resolveLoginUser(profile: GoogleProfile) {
  const bySub = await userRepository.findByGoogleSub(profile.sub);
  if (bySub) return { user: bySub };
  if (!profile.emailVerified) return { error: "email_nao_verificado" };

  const byEmail = await userRepository.findByEmail(profile.email);
  if (byEmail) {
    // Só conecta automaticamente se o e-mail da conta local já foi confirmado; senão alguém poderia
    // ter cadastrado o e-mail de outra pessoa com senha e "herdar" a conta (pre-account takeover).
    if (!byEmail.email_verified_at) return { error: "conta_existente" };
    return { user: await userRepository.update(byEmail.id, { googleSub: profile.sub }) };
  }
  return {
    user: await userRepository.create({
      name: profile.name,
      email: profile.email,
      passwordHash: null,
      googleSub: profile.sub,
      emailVerified: true,
    }),
  };
}

export const googleService = {
  startLogin: (remember: boolean) => start({ mode: "login", remember }, null),

  startLink: (userId: string) => start({ mode: "link", remember: false }, userId),

  /** Retorno do Google → devolve a URL do front para onde redirecionar. */
  async callback(query: Record<string, unknown>): Promise<string> {
    const state = typeof query.state === "string" ? query.state : "";
    const record = state ? await authTokens.consume<StatePayload>(state, "oauth_state") : null;
    if (!record) return loginError("expirado");
    const { mode, verifier, remember } = record.payload;
    const fail = (reason: string) => (mode === "link" ? linkResult(reason) : loginError(reason));

    if (typeof query.error === "string") return fail("cancelado");
    if (typeof query.code !== "string") return fail("falha");

    let profile: GoogleProfile;
    try {
      profile = await provider().exchange({ code: query.code, codeVerifier: verifier, redirectUri: googleRedirectUri() });
    } catch (err) {
      logger.warn({ err }, "Falha na troca do código do Google");
      return fail("falha");
    }

    if (mode === "link") {
      if (!record.userId) return fail("falha");
      const owner = await userRepository.findByGoogleSub(profile.sub);
      if (owner && owner.id !== record.userId) return fail("em_uso");
      await userRepository.update(record.userId, { googleSub: profile.sub });
      return linkResult("vinculado");
    }

    const resolved = await resolveLoginUser(profile);
    if (!resolved.user) return fail(resolved.error ?? "falha");
    const code = await authTokens.issue("oauth_exchange", EXCHANGE_TTL, {
      userId: resolved.user.id,
      payload: { remember },
    });
    return appLink("/entrar/google", { codigo: code });
  },

  /** O front troca o código de uso único (60 s) pela sessão — tokens nunca passam pela URL. */
  async exchange(code: string, meta: ClientMeta): Promise<LoginResponse> {
    const record = await authTokens.consume<{ remember: boolean }>(code, "oauth_exchange");
    const user = record?.userId ? await userRepository.findById(record.userId) : null;
    if (!record || !user) throw new UnauthorizedError("Login com Google expirou. Tente novamente.", "GOOGLE_EXPIRED");
    return completeLogin(user, record.payload.remember, meta);
  },

  async unlink(userId: string) {
    const user = await userRepository.findById(userId);
    if (!user) throw new UnauthorizedError();
    if (!user.password_hash) {
      throw new ConflictError("Defina uma senha antes de desconectar o Google, ou você perderá o acesso.", "PASSWORD_REQUIRED");
    }
    return toUserDTO(await userRepository.update(userId, { googleSub: null }));
  },
};
