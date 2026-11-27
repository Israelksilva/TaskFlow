import { createHash } from "node:crypto";
import { env, googleEnabled } from "../../config/env";

export interface GoogleProfile {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
}

/** Interface para trocar o Google por um fake nos testes (que nunca acessam a rede). */
export interface GoogleProvider {
  authorizationUrl(params: { state: string; codeVerifier: string; redirectUri: string }): string;
  exchange(params: { code: string; codeVerifier: string; redirectUri: string }): Promise<GoogleProfile>;
}

export const pkceChallenge = (verifier: string) => createHash("sha256").update(verifier).digest("base64url");

/** OAuth 2.0 / OpenID Connect com PKCE (fluxo de código no servidor). */
export class RealGoogleProvider implements GoogleProvider {
  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
  ) {}

  authorizationUrl({ state, codeVerifier, redirectUri }: { state: string; codeVerifier: string; redirectUri: string }) {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      state,
      code_challenge: pkceChallenge(codeVerifier),
      code_challenge_method: "S256",
      prompt: "select_account",
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }

  async exchange({ code, codeVerifier, redirectUri }: { code: string; codeVerifier: string; redirectUri: string }) {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
        code_verifier: codeVerifier,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`Google respondeu ${res.status}`);
    const { id_token: idToken } = (await res.json()) as { id_token?: string };
    if (!idToken) throw new Error("Google não devolveu id_token");
    // O id_token veio direto do Google por TLS, autenticado com o client secret (OIDC §3.1.3.7):
    // basta validar emissor, público e validade.
    const claims = JSON.parse(Buffer.from(idToken.split(".")[1], "base64url").toString("utf8")) as Record<string, unknown>;
    if (!["https://accounts.google.com", "accounts.google.com"].includes(String(claims.iss))) throw new Error("iss inválido");
    if (claims.aud !== this.clientId) throw new Error("aud inválido");
    if (typeof claims.exp !== "number" || claims.exp * 1000 < Date.now()) throw new Error("id_token expirado");
    if (typeof claims.sub !== "string" || typeof claims.email !== "string") throw new Error("id_token incompleto");
    return {
      sub: claims.sub,
      email: claims.email.toLowerCase(),
      emailVerified: claims.email_verified === true,
      name: typeof claims.name === "string" && claims.name.trim() ? claims.name.trim().slice(0, 80) : claims.email.split("@")[0],
    };
  }
}

let provider: GoogleProvider | null = googleEnabled
  ? new RealGoogleProvider(env.GOOGLE_CLIENT_ID!, env.GOOGLE_CLIENT_SECRET!)
  : null;

export const getGoogleProvider = () => provider;

/** Somente testes. */
export const setGoogleProvider = (p: GoogleProvider | null) => {
  provider = p;
};

export const googleRedirectUri = () => `${env.API_PUBLIC_URL.replace(/\/$/, "")}/v1/auth/google/callback`;
