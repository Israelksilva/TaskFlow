import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../src/db";
import { api, auth, createUser, resetDatabase } from "./helpers";

beforeEach(resetDatabase);

const refresh = (refreshToken: string) => api().post("/auth/sessao/renovar").send({ refreshToken });

describe("sessões e refresh token (S-03)", () => {
  it("renova a sessão trocando o refresh token e mantendo o mesmo id de sessão", async () => {
    const { refreshToken, accessToken } = await createUser();
    const res = await refresh(refreshToken).expect(200);
    expect(res.body.refreshToken).not.toBe(refreshToken);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.expiresIn).toBe(15 * 60);

    const sessions = await api().get("/conta/sessoes").set(auth(res.body.accessToken)).expect(200);
    expect(sessions.body.sessions).toHaveLength(1);
    // o token de acesso anterior continua válido até expirar (mesma sessão)
    await api().get("/auth/me").set(auth(accessToken)).expect(200);
  });

  it("reuso de refresh antigo depois da janela de corrida derruba a sessão inteira", async () => {
    const { refreshToken } = await createUser();
    const first = await refresh(refreshToken).expect(200);

    // dentro de 30 s: tratado como corrida entre abas, sem derrubar
    expect((await refresh(refreshToken).expect(401)).body.error.code).toBe("SESSION_ROTATED");
    await api().get("/auth/me").set(auth(first.body.accessToken)).expect(200);

    // simula o reuso tardio (token roubado)
    await db.query("UPDATE sessions SET rotated_at = now() - interval '5 minutes'");
    expect((await refresh(refreshToken).expect(401)).body.error.code).toBe("INVALID_REFRESH");
    expect((await api().get("/auth/me").set(auth(first.body.accessToken)).expect(401)).body.error.code).toBe(
      "SESSION_REVOKED",
    );
    await refresh(first.body.refreshToken).expect(401);
  });

  it("duas renovações simultâneas com o mesmo token: só uma vence", async () => {
    const { refreshToken } = await createUser();
    const results = await Promise.all([refresh(refreshToken), refresh(refreshToken)]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 401]);
  });

  it("sessão curta (sem 'manter conectado') expira em 24 h; longa em 30 dias e desliza", async () => {
    const short = await createUser();
    const long = await api()
      .post("/auth/login")
      .send({ email: short.user.email, password: short.password, remember: true })
      .expect(200);
    const { rows } = await db.query<{ remember: boolean; hours: number }>(
      "SELECT remember, round(extract(epoch FROM expires_at - created_at) / 3600) AS hours FROM sessions ORDER BY created_at",
    );
    expect(rows.map((r) => [r.remember, Number(r.hours)])).toEqual([
      [false, 24],
      [true, 720],
    ]);
    await refresh(long.body.refreshToken).expect(200);
  });

  it("refresh expirado ou inválido → 401", async () => {
    const { refreshToken } = await createUser();
    await db.query("UPDATE sessions SET expires_at = now() - interval '1 second'");
    expect((await refresh(refreshToken).expect(401)).body.error.code).toBe("INVALID_REFRESH");
    await refresh("x".repeat(43)).expect(401);
    await api().post("/auth/sessao/renovar").send({}).expect(422);
  });

  it("sair encerra só a sessão atual", async () => {
    const a = await createUser();
    const b = await api().post("/auth/login").send({ email: a.user.email, password: a.password }).expect(200);
    await api().post("/auth/sair").set(auth(a.accessToken)).expect(204);
    await api().get("/auth/me").set(auth(a.accessToken)).expect(401);
    await refresh(a.refreshToken).expect(401);
    await api().get("/auth/me").set(auth(b.body.accessToken)).expect(200);
  });

  it("lista sessões, encerra uma específica e as outras; não mexe nas de outro usuário", async () => {
    const a = await createUser();
    const a2 = await api().post("/auth/login").send({ email: a.user.email, password: a.password }).expect(200);
    const a3 = await api().post("/auth/login").send({ email: a.user.email, password: a.password }).expect(200);
    const other = await createUser();

    const list = await api().get("/conta/sessoes").set(auth(a.accessToken)).set("User-Agent", "Teste").expect(200);
    expect(list.body.sessions).toHaveLength(3);
    expect(list.body.sessions.filter((s: { current: boolean }) => s.current)).toHaveLength(1);

    const otherSession = (await api().get("/conta/sessoes").set(auth(other.accessToken))).body.sessions[0].id;
    await api().delete(`/conta/sessoes/${otherSession}`).set(auth(a.accessToken)).expect(404);
    await api().delete("/conta/sessoes/nao-e-uuid").set(auth(a.accessToken)).expect(404);

    const target = list.body.sessions.find((s: { current: boolean }) => !s.current).id;
    await api().delete(`/conta/sessoes/${target}`).set(auth(a.accessToken)).expect(204);

    const res = await api().post("/conta/sessoes/encerrar-outras").set(auth(a.accessToken)).expect(200);
    expect(res.body.revoked).toBe(1);
    await api().get("/auth/me").set(auth(a2.body.accessToken)).expect(401);
    await api().get("/auth/me").set(auth(a3.body.accessToken)).expect(401);
    await api().get("/auth/me").set(auth(a.accessToken)).expect(200);
    await api().get("/auth/me").set(auth(other.accessToken)).expect(200);
  });

  it("token de acesso sem sessão (formato anterior à Fase 4) exige novo login", async () => {
    const jwt = await import("jsonwebtoken");
    const { user } = await createUser();
    const legacy = jwt.default.sign({}, process.env.JWT_SECRET!, { subject: user.id, expiresIn: "1h" });
    expect((await api().get("/auth/me").set(auth(legacy)).expect(401)).body.error.code).toBe("INVALID_TOKEN");
  });
});
