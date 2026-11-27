import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../src/db";
import { totp, totpCounter, hotp, base32Decode, base32Encode, verifyTotp } from "../src/lib/totp";
import { api, auth, createUser, outbox, resetDatabase } from "./helpers";

beforeEach(async () => {
  await resetDatabase();
  outbox.clear();
});

/** Código de um passo diferente (o mesmo código não vale duas vezes). */
const codeAt = (secret: string, offsetSteps: number) => hotp(secret, totpCounter() + offsetSteps);

async function userWith2fa() {
  const u = await createUser();
  const setup = await api().post("/conta/2fa/configurar").set(auth(u.accessToken)).expect(200);
  const { secret } = setup.body as { secret: string; otpauthUrl: string };
  const enabled = await api().post("/conta/2fa/ativar").set(auth(u.accessToken)).send({ code: totp(secret) }).expect(200);
  return { ...u, secret, recoveryCodes: enabled.body.recoveryCodes as string[] };
}

describe("TOTP (RFC 6238)", () => {
  it("bate com os vetores de teste da RFC (SHA-1, 8→6 dígitos)", () => {
    const secret = base32Encode(Buffer.from("12345678901234567890"));
    expect(base32Decode(secret).toString()).toBe("12345678901234567890");
    // RFC 6238 Apêndice B: T=59 → 94287082 (8 dígitos) → 6 últimos: 287082
    expect(totp(secret, 59_000)).toBe("287082");
    expect(totp(secret, 1_111_111_109_000)).toBe("081804");
  });

  it("aceita ±1 passo e recusa formato inválido", () => {
    const secret = base32Encode(Buffer.from("12345678901234567890"));
    const now = 1_111_111_109_000;
    expect(verifyTotp(secret, totp(secret, now - 30_000), now)).not.toBeNull();
    expect(verifyTotp(secret, totp(secret, now - 90_000), now)).toBeNull();
    expect(verifyTotp(secret, "12345", now)).toBeNull();
  });
});

describe("2FA: ativação e login", () => {
  it("configura, ativa com código, devolve 10 códigos de recuperação e guarda o segredo cifrado", async () => {
    const u = await userWith2fa();
    expect(u.recoveryCodes).toHaveLength(10);
    expect(u.recoveryCodes[0]).toMatch(/^[A-Z0-9]{5}-[A-Z0-9]{5}$/);
    const { rows } = await db.query<{ totp_secret: string }>("SELECT totp_secret FROM users WHERE id = $1", [u.user.id]);
    expect(rows[0].totp_secret).toMatch(/^v1\./);
    expect(rows[0].totp_secret).not.toContain(u.secret);
    const me = await api().get("/auth/me").set(auth(u.accessToken)).expect(200);
    expect(me.body.user.twoFactorEnabled).toBe(true);
    expect(outbox.sent.some((m) => m.template === "2fa_enabled")).toBe(true);
    const status = await api().get("/conta/2fa").set(auth(u.accessToken)).expect(200);
    expect(status.body.recoveryCodesRemaining).toBe(10);
  });

  it("código errado na ativação → 422 (não derruba a sessão)", async () => {
    const u = await createUser();
    await api().post("/conta/2fa/configurar").set(auth(u.accessToken)).expect(200);
    const res = await api().post("/conta/2fa/ativar").set(auth(u.accessToken)).send({ code: "000000" }).expect(422);
    expect(res.body.error.details.code).toBeDefined();
    await api().post("/conta/2fa/ativar").set(auth(u.accessToken)).send({ code: "abc" }).expect(422);
  });

  it("login pede o código; com ele, abre a sessão; o mesmo código não vale duas vezes", async () => {
    const u = await userWith2fa();
    const step1 = await api().post("/auth/login").send({ email: u.user.email, password: u.password }).expect(200);
    expect(step1.body).toEqual({ mfaRequired: true, mfaToken: expect.any(String) });
    expect(step1.body).not.toHaveProperty("accessToken");

    const code = codeAt(u.secret, 1);
    const step2 = await api().post("/auth/2fa/login").send({ mfaToken: step1.body.mfaToken, code }).expect(200);
    expect(step2.body.accessToken).toEqual(expect.any(String));
    // desafio consumido
    await api().post("/auth/2fa/login").send({ mfaToken: step1.body.mfaToken, code }).expect(401);

    const again = await api().post("/auth/login").send({ email: u.user.email, password: u.password }).expect(200);
    await api().post("/auth/2fa/login").send({ mfaToken: again.body.mfaToken, code }).expect(422);
  });

  it("código de recuperação funciona uma única vez", async () => {
    const u = await userWith2fa();
    const [recovery] = u.recoveryCodes;
    const first = await api().post("/auth/login").send({ email: u.user.email, password: u.password });
    await api().post("/auth/2fa/login").send({ mfaToken: first.body.mfaToken, code: recovery.toLowerCase() }).expect(200);
    const second = await api().post("/auth/login").send({ email: u.user.email, password: u.password });
    await api().post("/auth/2fa/login").send({ mfaToken: second.body.mfaToken, code: recovery }).expect(422);
    const status = await api().get("/conta/2fa").set(auth(u.accessToken)).expect(200);
    expect(status.body.recoveryCodesRemaining).toBe(9);
  });

  it("5 códigos errados invalidam o desafio", async () => {
    const u = await userWith2fa();
    const { body } = await api().post("/auth/login").send({ email: u.user.email, password: u.password });
    for (let i = 0; i < 4; i += 1) {
      await api().post("/auth/2fa/login").send({ mfaToken: body.mfaToken, code: "000000" }).expect(422);
    }
    expect((await api().post("/auth/2fa/login").send({ mfaToken: body.mfaToken, code: "000000" }).expect(429)).body.error.code).toBe(
      "MFA_LOCKED",
    );
    await api().post("/auth/2fa/login").send({ mfaToken: body.mfaToken, code: codeAt(u.secret, 1) }).expect(401);
  });

  it("regenera códigos e desativa com código válido", async () => {
    const u = await userWith2fa();
    const regen = await api().post("/conta/2fa/codigos").set(auth(u.accessToken)).send({ code: codeAt(u.secret, 1) }).expect(200);
    expect(regen.body.recoveryCodes).toHaveLength(10);
    expect(regen.body.recoveryCodes).not.toContain(u.recoveryCodes[0]);

    await api().post("/conta/2fa/desativar").set(auth(u.accessToken)).send({}).expect(422);
    await api().post("/conta/2fa/desativar").set(auth(u.accessToken)).send({ code: u.recoveryCodes[0] }).expect(422);
    const off = await api().post("/conta/2fa/desativar").set(auth(u.accessToken)).send({ code: regen.body.recoveryCodes[0] }).expect(200);
    expect(off.body.user.twoFactorEnabled).toBe(false);
    const res = await api().post("/auth/login").send({ email: u.user.email, password: u.password }).expect(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
  });

  it("exige login e não reativa o que já está ativo", async () => {
    await api().post("/conta/2fa/configurar").expect(401);
    const u = await userWith2fa();
    await api().post("/conta/2fa/configurar").set(auth(u.accessToken)).expect(409);
  });
});
