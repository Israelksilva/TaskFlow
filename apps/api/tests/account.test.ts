import { beforeEach, describe, expect, it } from "vitest";
import { api, auth, createUser, outbox, resetDatabase } from "./helpers";

beforeEach(async () => {
  await resetDatabase();
  outbox.clear();
});

describe("PATCH /conta", () => {
  it("atualiza nome, idioma e fuso; recusa e-mail e campos desconhecidos", async () => {
    const u = await createUser();
    const res = await api().patch("/conta").set(auth(u.accessToken)).send({ name: "  Novo Nome ", timezone: "America/Bahia" }).expect(200);
    expect(res.body.user).toMatchObject({ name: "Novo Nome", timezone: "America/Bahia", locale: "pt-BR" });
    await api().patch("/conta").set(auth(u.accessToken)).send({ email: "x@y.dev" }).expect(422);
    await api().patch("/conta").set(auth(u.accessToken)).send({ locale: "en-US" }).expect(422);
    await api().patch("/conta").send({ name: "X" }).expect(401);
  });
});

describe("POST /conta/senha", () => {
  it("exige a senha atual, troca, encerra as outras sessões e avisa por e-mail", async () => {
    const u = await createUser();
    const other = await api().post("/auth/login").send({ email: u.user.email, password: u.password }).expect(200);

    const wrong = await api().post("/conta/senha").set(auth(u.accessToken)).send({ currentPassword: "errada99", newPassword: "novaSenha1" }).expect(422);
    expect(wrong.body.error.details.currentPassword).toBeDefined();
    await api().post("/conta/senha").set(auth(u.accessToken)).send({ newPassword: "novaSenha1" }).expect(422);

    await api().post("/conta/senha").set(auth(u.accessToken)).send({ currentPassword: u.password, newPassword: "novaSenha1" }).expect(200);
    await api().get("/auth/me").set(auth(u.accessToken)).expect(200);
    await api().get("/auth/me").set(auth(other.body.accessToken)).expect(401);
    await api().post("/auth/login").send({ email: u.user.email, password: "novaSenha1" }).expect(200);
    expect(outbox.sent.some((m) => m.template === "password_changed")).toBe(true);
  });
});
