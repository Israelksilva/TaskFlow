import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../src/db";
import { decrypt } from "../src/lib/crypto";
import { generateCode } from "../src/lib/totp";
import { api, auth, createUser, resetDatabase, runPendingJobs, sentMail, tokenFromMail } from "./helpers";

beforeEach(resetDatabase);

describe("sessões e refresh token", () => {
  it("cadastro devolve refresh token e cria workspace pessoal com projeto padrão", async () => {
    const { token, refreshToken, expiresIn } = await createUser();
    expect(refreshToken).toEqual(expect.any(String));
    expect(expiresIn).toBe(900);
    const res = await api().get("/v1/workspaces").set(auth(token)).expect(200);
    expect(res.body.workspaces).toHaveLength(1);
    expect(res.body.workspaces[0]).toMatchObject({ isPersonal: true, role: "owner" });
    const projects = await api().get(`/v1/workspaces/${res.body.workspaces[0].id}/projetos`).set(auth(token)).expect(200);
    expect(projects.body.projects[0]).toMatchObject({ name: "Minhas tarefas", isDefault: true });
  });

  it("rotaciona o refresh token e revoga a sessão se um token antigo for reutilizado", async () => {
    const { refreshToken } = await createUser();
    const first = await api().post("/v1/auth/refresh").send({ refreshToken }).expect(200);
    expect(first.body.refreshToken).not.toBe(refreshToken);

    // Reuso do token antigo (indício de roubo) → 401 e a sessão inteira cai.
    await api().post("/v1/auth/refresh").send({ refreshToken }).expect(401);
    await api().post("/v1/auth/refresh").send({ refreshToken: first.body.refreshToken }).expect(401);
    await api().get("/v1/auth/me").set(auth(first.body.token)).expect(401);
  });

  it("logout invalida o access token imediatamente", async () => {
    const { token } = await createUser();
    await api().post("/v1/auth/logout").set(auth(token)).send({}).expect(204);
    const res = await api().get("/v1/auth/me").set(auth(token)).expect(401);
    expect(res.body.error.code).toBe("SESSION_REVOKED");
  });

  it("lista sessões e encerra as outras", async () => {
    const { user, password, token } = await createUser();
    const other = await api().post("/v1/auth/login").send({ email: user.email, password }).expect(200);
    const list = await api().get("/v1/auth/sessoes").set(auth(token)).expect(200);
    expect(list.body.sessions).toHaveLength(2);
    expect(list.body.sessions.filter((s: { current: boolean }) => s.current)).toHaveLength(1);

    await api().post("/v1/auth/sessoes/encerrar-outras").set(auth(token)).expect(200);
    await api().get("/v1/auth/me").set(auth(other.body.token)).expect(401);
    await api().get("/v1/auth/me").set(auth(token)).expect(200);
  });
});

describe("proteção contra força bruta", () => {
  it("bloqueia a conta após 5 senhas erradas, mesmo com a senha certa depois", async () => {
    const { user, password } = await createUser();
    for (let i = 0; i < 5; i++) await api().post("/v1/auth/login").send({ email: user.email, password: "errada123" }).expect(401);
    const res = await api().post("/v1/auth/login").send({ email: user.email, password }).expect(429);
    expect(res.body.error.code).toBe("TOO_MANY_REQUESTS");
  });
});

describe("verificação de e-mail e redefinição de senha", () => {
  it("envia e-mail de verificação e confirma com o token (uso único)", async () => {
    const { user, token } = await createUser();
    await runPendingJobs();
    const verify = tokenFromMail(user.email, "verificar-email");
    expect(user.emailVerified).toBe(false);
    await api().post("/v1/auth/verificar-email").send({ token: verify }).expect(200);
    await api().post("/v1/auth/verificar-email").send({ token: verify }).expect(400);
    expect((await api().get("/v1/auth/me").set(auth(token))).body.user.emailVerified).toBe(true);
  });

  it("não revela se o e-mail existe e redefine a senha encerrando sessões", async () => {
    const { user, token } = await createUser();
    await api().post("/v1/auth/esqueci-senha").send({ email: "ninguem@test.dev" }).expect(202);
    await api().post("/v1/auth/esqueci-senha").send({ email: user.email }).expect(202);
    await runPendingJobs();
    const reset = tokenFromMail(user.email, "redefinir-senha");

    await api().post("/v1/auth/redefinir-senha").send({ token: reset, password: "novaSenha123" }).expect(200);
    await api().get("/v1/auth/me").set(auth(token)).expect(401);
    await api().post("/v1/auth/login").send({ email: user.email, password: "novaSenha123" }).expect(200);
    await api().post("/v1/auth/redefinir-senha").send({ token: reset, password: "outraSenha123" }).expect(400);
  });

  it("o conteúdo do e-mail é apagado da fila após o envio", async () => {
    await createUser();
    await runPendingJobs();
    const { rows } = await db.query<{ payload: object }>(`SELECT payload FROM jobs WHERE type = 'email.send'`);
    expect(rows.every((r) => Object.keys(r.payload).length === 0)).toBe(true);
    expect(sentMail.length).toBeGreaterThan(0);
  });
});

describe("autenticação em duas etapas (TOTP)", () => {
  it("ativa 2FA, exige o código no login e guarda o segredo cifrado", async () => {
    const { user, password, token } = await createUser();
    const setup = await api().post("/v1/auth/2fa/configurar").set(auth(token)).expect(200);
    expect(setup.body.otpauthUrl).toContain("otpauth://totp/");
    await api().post("/v1/auth/2fa/ativar").set(auth(token)).send({ code: "000000" }).expect(400);
    await api().post("/v1/auth/2fa/ativar").set(auth(token)).send({ code: generateCode(setup.body.secret) }).expect(200);

    const { rows } = await db.query<{ totp_secret: string }>(`SELECT totp_secret FROM users WHERE id = $1`, [user.id]);
    expect(rows[0].totp_secret).not.toBe(setup.body.secret);
    expect(decrypt(rows[0].totp_secret)).toBe(setup.body.secret);

    const login = await api().post("/v1/auth/login").send({ email: user.email, password }).expect(200);
    expect(login.body).toMatchObject({ mfaRequired: true });
    expect(login.body.token).toBeUndefined();
    await api().post("/v1/auth/login/2fa").send({ mfaToken: login.body.mfaToken, code: "123456" }).expect(401);
    const ok = await api()
      .post("/v1/auth/login/2fa")
      .send({ mfaToken: login.body.mfaToken, code: generateCode(setup.body.secret) })
      .expect(200);
    expect(ok.body.token).toEqual(expect.any(String));
  });
});

describe("conta (LGPD)", () => {
  it("exporta dados e exclui a conta com confirmação", async () => {
    const { token, password, user } = await createUser();
    const exported = await api().get("/v1/auth/exportar").set(auth(token)).expect(200);
    expect(exported.body.user.email).toBe(user.email);
    await api().post("/v1/auth/excluir-conta").set(auth(token)).send({ password, confirmation: "errado" }).expect(422);
    await api().post("/v1/auth/excluir-conta").set(auth(token)).send({ password, confirmation: "EXCLUIR" }).expect(204);
    await api().post("/v1/auth/login").send({ email: user.email, password }).expect(401);
  });
});
