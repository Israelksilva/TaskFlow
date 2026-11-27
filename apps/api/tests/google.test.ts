import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "../src/db";
import { type GoogleProfile, type GoogleProvider, setGoogleProvider } from "../src/modules/google/google.provider";
import { api, auth, createUser, resetDatabase } from "./helpers";

/** Provedor falso: o "código" do Google é a chave de um perfil cadastrado no teste. */
class FakeGoogle implements GoogleProvider {
  profiles = new Map<string, GoogleProfile>();
  lastVerifier = "";
  authorizationUrl({ state, codeVerifier }: { state: string; codeVerifier: string }) {
    this.lastVerifier = codeVerifier;
    return `https://google.test/auth?state=${state}`;
  }
  async exchange({ code, codeVerifier }: { code: string; codeVerifier: string }) {
    if (codeVerifier !== this.lastVerifier) throw new Error("PKCE");
    const p = this.profiles.get(code);
    if (!p) throw new Error("código inválido");
    return p;
  }
}

const google = new FakeGoogle();
beforeEach(async () => {
  await resetDatabase();
  google.profiles.clear();
  setGoogleProvider(google);
});
afterAll(() => setGoogleProvider(null));

const stateFrom = (url: string) => new URL(url).searchParams.get("state")!;
/** Hash route do front → parâmetros. */
const hashParams = (location: string) => new URLSearchParams(location.split("?")[1] ?? "");

async function googleLogin(profile: GoogleProfile, remember = false) {
  google.profiles.set("cod-1", profile);
  const start = await api().post("/auth/google/iniciar").send({ remember }).expect(200);
  const cb = await api().get("/auth/google/callback").query({ code: "cod-1", state: stateFrom(start.body.url) }).expect(303);
  return cb.headers.location as string;
}

const profile = (over: Partial<GoogleProfile> = {}): GoogleProfile => ({
  sub: "g-123",
  email: "gabi@gmail.com",
  emailVerified: true,
  name: "Gabi Rocha",
  ...over,
});

describe("login com Google", () => {
  it("cria conta sem senha, verificada, e troca o código de uso único pela sessão", async () => {
    const location = await googleLogin(profile());
    expect(location).toMatch(/^http:\/\/localhost:8080\/#\/entrar\/google\?codigo=/);
    const code = hashParams(location).get("codigo")!;

    const res = await api().post("/auth/google/trocar").send({ code }).expect(200);
    expect(res.body.user).toMatchObject({ email: "gabi@gmail.com", name: "Gabi Rocha", emailVerified: true, hasPassword: false, googleLinked: true });
    await api().post("/auth/google/trocar").send({ code }).expect(401);
    // conta sem senha não entra por senha
    await api().post("/auth/login").send({ email: "gabi@gmail.com", password: "qualquer1" }).expect(401);
  });

  it("entra de novo na mesma conta pelo sub e respeita o 2FA", async () => {
    const first = hashParams(await googleLogin(profile())).get("codigo")!;
    const s = await api().post("/auth/google/trocar").send({ code: first }).expect(200);
    await db.query("UPDATE users SET totp_secret = 'v1.x.y.z', totp_enabled_at = now() WHERE id = $1", [s.body.user.id]);
    const second = hashParams(await googleLogin(profile({ email: "outro@gmail.com" }))).get("codigo")!;
    const res = await api().post("/auth/google/trocar").send({ code: second }).expect(200);
    expect(res.body).toEqual({ mfaRequired: true, mfaToken: expect.any(String) });
    const { rows } = await db.query("SELECT count(*)::int AS n FROM users");
    expect(rows[0]).toEqual({ n: 1 });
  });

  it("conecta à conta existente só se o e-mail dela já foi verificado (evita tomada de conta)", async () => {
    const local = await createUser({ email: "gabi@gmail.com" });
    const blocked = await googleLogin(profile());
    expect(hashParams(blocked).get("erro")).toBe("google_conta_existente");

    await db.query("UPDATE users SET email_verified_at = now() WHERE id = $1", [local.user.id]);
    const code = hashParams(await googleLogin(profile())).get("codigo")!;
    const res = await api().post("/auth/google/trocar").send({ code }).expect(200);
    expect(res.body.user).toMatchObject({ id: local.user.id, hasPassword: true, googleLinked: true });
  });

  it("recusa e-mail não verificado pelo Google, state inválido e cancelamento", async () => {
    expect(hashParams(await googleLogin(profile({ emailVerified: false }))).get("erro")).toBe("google_email_nao_verificado");
    const bad = await api().get("/auth/google/callback").query({ code: "x", state: "y".repeat(43) }).expect(303);
    expect(hashParams(bad.headers.location).get("erro")).toBe("google_expirado");
    const start = await api().post("/auth/google/iniciar").send({}).expect(200);
    const cancel = await api().get("/auth/google/callback").query({ error: "access_denied", state: stateFrom(start.body.url) }).expect(303);
    expect(hashParams(cancel.headers.location).get("erro")).toBe("google_cancelado");
  });

  it("desligado quando não configurado", async () => {
    setGoogleProvider(null);
    expect((await api().post("/auth/google/iniciar").send({}).expect(503)).body.error.code).toBe("GOOGLE_DISABLED");
    expect((await api().get("/auth/config")).body.googleEnabled).toBe(false);
  });
});

describe("conectar e desconectar o Google nas configurações", () => {
  it("vincula à conta logada; recusa conta Google já usada por outro usuário", async () => {
    const u = await createUser();
    google.profiles.set("cod-1", profile());
    const start = await api().post("/conta/google/vincular").set(auth(u.accessToken)).expect(200);
    const cb = await api().get("/auth/google/callback").query({ code: "cod-1", state: stateFrom(start.body.url) }).expect(303);
    expect(cb.headers.location).toBe("http://localhost:8080/#/app/configuracoes?aba=seguranca&google=vinculado");
    expect((await api().get("/auth/me").set(auth(u.accessToken))).body.user.googleLinked).toBe(true);

    const other = await createUser();
    const s2 = await api().post("/conta/google/vincular").set(auth(other.accessToken)).expect(200);
    const cb2 = await api().get("/auth/google/callback").query({ code: "cod-1", state: stateFrom(s2.body.url) }).expect(303);
    expect(hashParams(cb2.headers.location).get("google")).toBe("em_uso");
  });

  it("desconecta só se a conta tiver senha", async () => {
    const code = hashParams(await googleLogin(profile())).get("codigo")!;
    const s = await api().post("/auth/google/trocar").send({ code }).expect(200);
    const res = await api().delete("/conta/google").set(auth(s.body.accessToken)).expect(409);
    expect(res.body.error.code).toBe("PASSWORD_REQUIRED");

    await api().post("/conta/senha").set(auth(s.body.accessToken)).send({ newPassword: "minhaSenha1" }).expect(200);
    const ok = await api().delete("/conta/google").set(auth(s.body.accessToken)).expect(200);
    expect(ok.body.user).toMatchObject({ googleLinked: false, hasPassword: true });
  });
});
