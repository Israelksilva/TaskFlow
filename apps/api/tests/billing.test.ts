import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "../src/config/env";
import { db } from "../src/db";
import { resetTestCheck } from "../src/lib/mercadopago";
import { api, auth, createTeamWorkspace, createUser, resetDatabase, runPendingJobs } from "./helpers";

/**
 * Mercado Pago simulado: nenhuma chamada sai da máquina. Verifica a lógica de modo teste, checkout,
 * webhook assinado, aplicação de plano e cancelamento.
 */
const SECRET = "segredo-webhook-de-teste";
let preapprovals: Record<string, Record<string, unknown>>;
let usersMeTags: string[];
const realFetch = globalThis.fetch;

function mockMercadoPago() {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    if (!url.startsWith("https://api.mercadopago.com")) return realFetch(input, init);
    const method = init?.method ?? "GET";
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
    if (url.endsWith("/users/me")) return json({ id: 1, tags: usersMeTags });
    if (url.endsWith("/preapproval") && method === "POST") {
      const body = JSON.parse(String(init?.body));
      const id = `pre_${Object.keys(preapprovals).length + 1}`;
      preapprovals[id] = { id, status: "pending", external_reference: body.external_reference, payer_email: body.payer_email, auto_recurring: body.auto_recurring, init_point: `https://www.mercadopago.com.br/subscriptions/checkout?preapproval_id=${id}` };
      return json(preapprovals[id], 201);
    }
    const m = url.match(/\/preapproval\/([^/?]+)/);
    if (m && preapprovals[m[1]]) {
      if (method === "PUT") Object.assign(preapprovals[m[1]], JSON.parse(String(init?.body)));
      return json(preapprovals[m[1]]);
    }
    return json({ message: "not found" }, 404);
  });
}

const sign = (dataId: string, requestId: string, ts = String(Date.now())) =>
  `ts=${ts},v1=${createHmac("sha256", SECRET).update(`id:${dataId};request-id:${requestId};ts:${ts};`).digest("hex")}`;

function webhook(dataId: string, requestId: string, signature = sign(dataId, requestId)) {
  return api()
    .post(`/v1/pagamentos/webhook?data.id=${dataId}&type=subscription_preapproval`)
    .set("x-request-id", requestId)
    .set("x-signature", signature)
    .send({ type: "subscription_preapproval", data: { id: dataId } });
}

const planOf = async (wsId: string) => (await db.query<{ plan: string }>(`SELECT plan FROM workspaces WHERE id = $1`, [wsId])).rows[0].plan;

beforeEach(async () => {
  await resetDatabase();
  await db.query("DELETE FROM subscriptions");
  await db.query("DELETE FROM payment_events");
  preapprovals = {};
  usersMeTags = ["test_user"];
  env.MP_ACCESS_TOKEN = "APP_USR-token-de-usuario-de-teste";
  env.MP_WEBHOOK_SECRET = SECRET;
  resetTestCheck();
  mockMercadoPago();
});
afterEach(() => {
  vi.restoreAllMocks();
  env.MP_ACCESS_TOKEN = undefined;
  env.MP_WEBHOOK_SECRET = undefined;
});

describe("assinaturas (Mercado Pago, modo teste)", () => {
  it("sem credencial: indisponível (503), sem simular", async () => {
    env.MP_ACCESS_TOKEN = undefined;
    const owner = await createUser();
    const ws = await createTeamWorkspace(owner.token);
    expect((await api().get(`/v1/workspaces/${ws.id}/assinatura`).set(auth(owner.token))).body.available).toBe(false);
    const res = await api().post(`/v1/workspaces/${ws.id}/assinatura/checkout`).set(auth(owner.token)).send({ plan: "pro", payerEmail: "comprador@testuser.com" });
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("PAYMENTS_NOT_CONFIGURED");
  });

  it("recusa credencial que não é de teste", async () => {
    usersMeTags = ["normal"];
    const owner = await createUser();
    const ws = await createTeamWorkspace(owner.token);
    const res = await api().post(`/v1/workspaces/${ws.id}/assinatura/checkout`).set(auth(owner.token)).send({ plan: "pro", payerEmail: "x@testuser.com" });
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("PAYMENTS_TEST_ONLY");
    expect(Object.keys(preapprovals)).toHaveLength(0);
    expect((await db.query(`SELECT count(*)::int AS n FROM subscriptions`)).rows[0].n).toBe(0);
  });

  it("checkout → webhook assinado autoriza → plano Pro; cancelamento mantém até o fim do ciclo", async () => {
    const owner = await createUser();
    const ws = await createTeamWorkspace(owner.token);
    const res = await api().post(`/v1/workspaces/${ws.id}/assinatura/checkout`).set(auth(owner.token)).send({ plan: "pro", payerEmail: "Comprador@TestUser.com" }).expect(201);
    expect(res.body.checkoutUrl).toContain("mercadopago.com.br");
    expect(res.body.subscription).toMatchObject({ plan: "pro", status: "pending", amountCents: 2990, testMode: true, payerEmail: "comprador@testuser.com" });
    expect(preapprovals.pre_1.auto_recurring).toMatchObject({ transaction_amount: 29.9, currency_id: "BRL", frequency_type: "months" });

    // Assinatura inválida é recusada e nada muda.
    await webhook("pre_1", "req-0", "ts=1,v1=" + "0".repeat(64)).expect(401);
    expect(await planOf(ws.id)).toBe("free");

    const next = new Date(Date.now() + 20 * 86_400_000).toISOString();
    Object.assign(preapprovals.pre_1, { status: "authorized", next_payment_date: next });
    expect((await webhook("pre_1", "req-1").expect(200)).body.result).toBe("processed");
    expect(await planOf(ws.id)).toBe("pro");
    // Reenvio da mesma notificação é idempotente.
    expect((await webhook("pre_1", "req-1").expect(200)).body.result).toBe("duplicate");
    const notes = await db.query(`SELECT 1 FROM notifications WHERE user_id = $1 AND type = 'plan.changed'`, [owner.user.id]);
    expect(notes.rows).toHaveLength(1);

    // Cancelar: continua Pro até a próxima cobrança; depois, Free (dados preservados).
    const cancelled = await api().post(`/v1/workspaces/${ws.id}/assinatura/cancelar`).set(auth(owner.token)).expect(200);
    expect(cancelled.body.subscription).toMatchObject({ status: "cancelled" });
    expect(preapprovals.pre_1.status).toBe("cancelled");
    expect(await planOf(ws.id)).toBe("pro");
    await db.query(`UPDATE subscriptions SET ends_at = now() - interval '1 minute'`);
    await db.query(`INSERT INTO jobs (type, payload) VALUES ('billing.expire', '{}')`);
    await runPendingJobs(10);
    expect(await planOf(ws.id)).toBe("free");

    const audit = await db.query<{ action: string }>(`SELECT action FROM audit_log WHERE workspace_id = $1 AND action LIKE 'billing.%' ORDER BY id`, [ws.id]);
    expect(audit.rows.map((r) => r.action)).toEqual(["billing.checkout_started", "billing.plan_changed", "billing.cancelled", "billing.plan_changed"]);
  });

  it("valor adulterado no provedor não libera o plano", async () => {
    const owner = await createUser();
    const ws = await createTeamWorkspace(owner.token);
    await api().post(`/v1/workspaces/${ws.id}/assinatura/checkout`).set(auth(owner.token)).send({ plan: "business", payerEmail: "c@testuser.com" }).expect(201);
    Object.assign(preapprovals.pre_1, { status: "authorized", auto_recurring: { transaction_amount: 1, currency_id: "BRL" } });
    await webhook("pre_1", "req-x").expect(400);
    expect(await planOf(ws.id)).toBe("free");
  });

  it("só o proprietário gerencia a assinatura; sincronizar aplica o estado do provedor", async () => {
    const owner = await createUser();
    const admin = await createUser();
    const ws = await createTeamWorkspace(owner.token);
    await db.query(`INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'admin')`, [ws.id, admin.user.id]);
    await api().get(`/v1/workspaces/${ws.id}/assinatura`).set(auth(admin.token)).expect(403);
    await api().post(`/v1/workspaces/${ws.id}/assinatura/checkout`).set(auth(admin.token)).send({ plan: "pro", payerEmail: "c@testuser.com" }).expect(403);

    await api().post(`/v1/workspaces/${ws.id}/assinatura/checkout`).set(auth(owner.token)).send({ plan: "pro", payerEmail: "c@testuser.com" }).expect(201);
    preapprovals.pre_1.status = "authorized";
    const synced = await api().post(`/v1/workspaces/${ws.id}/assinatura/sincronizar`).set(auth(owner.token)).expect(200);
    expect(synced.body.subscription.status).toBe("authorized");
    expect(await planOf(ws.id)).toBe("pro");
    // Com assinatura ativa, novo checkout é bloqueado.
    await api().post(`/v1/workspaces/${ws.id}/assinatura/checkout`).set(auth(owner.token)).send({ plan: "business", payerEmail: "c@testuser.com" }).expect(409);
  });
});
