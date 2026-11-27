import bcrypt from "bcryptjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../src/db";
import { lockMinutes } from "../src/modules/auth/login-throttle";
import { api, auth, createUser, outbox, resetDatabase, tokenFromMail } from "./helpers";

beforeEach(async () => {
  await resetDatabase();
  outbox.clear();
});

const login = (email: string, password: string) => api().post("/auth/login").send({ email, password });

describe("bloqueio progressivo (S-06) sem revelar contas (S-04)", () => {
  it("calcula a espera: livre até 4 falhas, depois 1, 2, 4… até 30 min", () => {
    expect([1, 4, 5, 6, 7, 10, 20].map(lockMinutes)).toEqual([0, 0, 1, 2, 4, 30, 30]);
  });

  it("bloqueia após 5 falhas, da mesma forma para e-mail existente e inexistente", async () => {
    const { user, password } = await createUser();
    for (const email of [user.email, "fantasma@test.dev"]) {
      for (let i = 0; i < 5; i += 1) await login(email, "errada123").expect(401);
      const locked = await login(email, "errada123").expect(429);
      expect(locked.body.error.code).toBe("LOGIN_LOCKED");
      expect(locked.body.error.message).toMatch(/1 minuto/);
    }
    // mesmo a senha certa espera o bloqueio acabar
    await login(user.email, password).expect(429);
    await db.query("UPDATE login_throttle SET locked_until = now() - interval '1 second'");
    await login(user.email, password).expect(200);
    // sucesso zera o contador
    const { rows } = await db.query("SELECT 1 FROM login_throttle WHERE email = $1", [user.email]);
    expect(rows).toHaveLength(0);
  });
});

describe("bcrypt 12 com rehash (S-08)", () => {
  it("refaz o hash de custo menor que o atual no login bem-sucedido", async () => {
    const { user, password } = await createUser();
    // Nos testes o custo atual é 5 (12 em produção); 4 faz o papel do antigo 10.
    const old = bcrypt.hashSync(password, 4);
    await db.query("UPDATE users SET password_hash = $2 WHERE id = $1", [user.id, old]);
    await login(user.email, password).expect(200);
    const { rows } = await db.query<{ password_hash: string }>("SELECT password_hash FROM users WHERE id = $1", [user.id]);
    expect(bcrypt.getRounds(rows[0].password_hash)).toBe(5);
    expect(bcrypt.compareSync(password, rows[0].password_hash)).toBe(true);
  });
});

describe("verificação de e-mail", () => {
  it("o cadastro envia o link; verificar marca a conta; o link não vale duas vezes", async () => {
    const { user, accessToken } = await createUser({ name: "Bia Lima" });
    expect(user.emailVerified).toBe(false);
    const mail = outbox.sent.find((m) => m.template === "verify_email")!;
    expect(mail.to).toBe(user.email);
    expect(mail.subject).toMatch(/Confirme/);
    expect(mail.html).toContain("Olá, Bia!");
    expect(mail.text).toContain("http://localhost:8080/#/verificar-email?token=");

    const token = tokenFromMail("verify_email");
    const res = await api().post("/auth/email/verificar").send({ token }).expect(200);
    expect(res.body.user.emailVerified).toBe(true);
    await api().post("/auth/email/verificar").send({ token }).expect(422);
    expect((await api().get("/auth/me").set(auth(accessToken))).body.user.emailVerified).toBe(true);
  });

  it("reenviar invalida o link anterior e exige login", async () => {
    const { accessToken } = await createUser();
    const first = tokenFromMail("verify_email");
    await api().post("/auth/email/reenviar").expect(401);
    await api().post("/auth/email/reenviar").set(auth(accessToken)).expect(202);
    const second = tokenFromMail("verify_email");
    expect(second).not.toBe(first);
    await api().post("/auth/email/verificar").send({ token: first }).expect(422);
    await api().post("/auth/email/verificar").send({ token: second }).expect(200);
  });
});

describe("recuperação de senha (S-05)", () => {
  it("responde igual para e-mail existente e inexistente", async () => {
    const { user } = await createUser();
    outbox.clear();
    const a = await api().post("/auth/senha/esqueci").send({ email: user.email }).expect(202);
    const b = await api().post("/auth/senha/esqueci").send({ email: "nao@existe.dev" }).expect(202);
    expect(a.body).toEqual(b.body);
    await vi.waitFor(() => expect(outbox.sent.filter((m) => m.template === "reset_password")).toHaveLength(1));
    expect(outbox.sent[0].to).toBe(user.email);
  });

  it("redefine, encerra todas as sessões, verifica o e-mail e o link é de uso único", async () => {
    const { user, accessToken } = await createUser();
    await api().post("/auth/senha/esqueci").send({ email: user.email }).expect(202);
    await vi.waitFor(() => tokenFromMail("reset_password"));
    const token = tokenFromMail("reset_password");

    await api().post("/auth/senha/redefinir").send({ token, password: "curta" }).expect(422);
    await api().post("/auth/senha/redefinir").send({ token, password: "novaSenha99" }).expect(204);
    await api().post("/auth/senha/redefinir").send({ token, password: "outraSenha99" }).expect(422);

    await api().get("/auth/me").set(auth(accessToken)).expect(401);
    await login(user.email, "senha1234").expect(401);
    const res = await login(user.email, "novaSenha99").expect(200);
    expect(res.body.user.emailVerified).toBe(true);
    expect(outbox.sent.some((m) => m.template === "password_changed")).toBe(true);
  });

  it("só o último link pedido vale; link expirado é recusado", async () => {
    const { user } = await createUser();
    await api().post("/auth/senha/esqueci").send({ email: user.email });
    await vi.waitFor(() => tokenFromMail("reset_password"));
    const first = tokenFromMail("reset_password");
    outbox.clear();
    await api().post("/auth/senha/esqueci").send({ email: user.email });
    await vi.waitFor(() => tokenFromMail("reset_password"));
    const second = tokenFromMail("reset_password");

    await api().post("/auth/senha/redefinir").send({ token: first, password: "novaSenha99" }).expect(422);
    await db.query("UPDATE auth_tokens SET expires_at = now() - interval '1 second' WHERE purpose = 'reset_password'");
    await api().post("/auth/senha/redefinir").send({ token: second, password: "novaSenha99" }).expect(422);
  });
});

describe("GET /auth/config", () => {
  it("informa o que está habilitado (em teste o e-mail vai para a memória)", async () => {
    const res = await api().get("/v1/auth/config").expect(200);
    expect(res.body).toEqual({ emailEnabled: true, googleEnabled: false });
  });
});
