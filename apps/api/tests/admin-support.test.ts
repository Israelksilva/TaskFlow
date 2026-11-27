import { beforeEach, describe, expect, it } from "vitest";
import type { AdminOverview, SupportTicket } from "@andamo/shared";
import { db } from "../src/db";
import { generateCode } from "../src/lib/totp";
import { api, auth, createTeamWorkspace, createUser, resetDatabase, runPendingJobs } from "./helpers";

beforeEach(async () => {
  await resetDatabase();
  await db.query("DELETE FROM support_tickets");
  await db.query("DELETE FROM announcements");
});

/** Admin da plataforma com 2FA ativo (como exigido pelo painel). */
async function createAdmin() {
  const admin = await createUser({ name: "Ana Admin" });
  await db.query(`UPDATE users SET is_platform_admin = true WHERE id = $1`, [admin.user.id]);
  const setup = await api().post("/v1/auth/2fa/configurar").set(auth(admin.token)).expect(200);
  await api().post("/v1/auth/2fa/ativar").set(auth(admin.token)).send({ code: generateCode(setup.body.secret) }).expect(200);
  return admin;
}

const notifications = async (userId: string, type: string) =>
  (await db.query(`SELECT title FROM notifications WHERE user_id = $1 AND type = $2`, [userId, type])).rows;

describe("painel administrativo", () => {
  it("é restrito: usuário comum 403; admin sem 2FA 403 com código específico", async () => {
    const user = await createUser();
    await api().get("/v1/admin/visao-geral").set(auth(user.token)).expect(403);
    await db.query(`UPDATE users SET is_platform_admin = true WHERE id = $1`, [user.user.id]);
    const res = await api().get("/v1/admin/visao-geral").set(auth(user.token)).expect(403);
    expect(res.body.error.code).toBe("ADMIN_MFA_REQUIRED");
  });

  it("visão geral com métricas reais e MRR pelos planos atribuídos", async () => {
    const admin = await createAdmin();
    const owner = await createUser();
    const ws = await createTeamWorkspace(owner.token, "Cliente Pro");
    await api().post(`/v1/admin/workspaces/${ws.id}/plano`).set(auth(admin.token)).send({ plan: "pro", reason: "Contrato fechado" }).expect(204);

    const o = (await api().get("/v1/admin/visao-geral").set(auth(admin.token)).expect(200)).body as AdminOverview;
    expect(o.users.total).toBe(2);
    expect(o.users.new7d).toBe(2);
    expect(o.subscriptions).toBe(1);
    expect(o.mrrCents).toBe(2990);
    expect(o.workspaces.byPlan.pro).toBe(1);
    expect(o.conversionRate).toBe(100);
    expect(o.signups).toHaveLength(30);

    // Plano alterado: dono avisado e auditoria registrada com o motivo.
    expect(await notifications(owner.user.id, "plan.changed")).toHaveLength(1);
    const audit = (await api().get("/v1/admin/auditoria?action=admin.plan").set(auth(admin.token))).body.items;
    expect(audit[0]).toMatchObject({ action: "admin.plan_changed", data: { from: "free", to: "pro", reason: "Contrato fechado" } });

    // Downgrade conta como cancelamento.
    await api().post(`/v1/admin/workspaces/${ws.id}/plano`).set(auth(admin.token)).send({ plan: "free", reason: "Cancelou" }).expect(204);
    expect((await api().get("/v1/admin/visao-geral").set(auth(admin.token))).body.cancellations30d).toBe(1);
  });

  it("suspensão derruba sessões, bloqueia login e é reversível", async () => {
    const admin = await createAdmin();
    const user = await createUser();
    await api().post(`/v1/admin/usuarios/${user.user.id}/suspensao`).set(auth(admin.token)).send({ suspended: true, reason: "x" }).expect(422);
    await api().post(`/v1/admin/usuarios/${user.user.id}/suspensao`).set(auth(admin.token)).send({ suspended: true, reason: "Abuso" }).expect(204);
    await api().get("/v1/auth/me").set(auth(user.token)).expect(401);
    const login = await api().post("/v1/auth/login").send({ email: user.user.email, password: user.password }).expect(403);
    expect(login.body.error.code).toBe("ACCOUNT_SUSPENDED");
    await api().post("/v1/auth/refresh").send({ refreshToken: user.refreshToken }).expect(401);
    // Senha errada continua dando 401 genérico (não revela a suspensão).
    await api().post("/v1/auth/login").send({ email: user.user.email, password: "errada1234" }).expect(401);

    const list = (await api().get("/v1/admin/usuarios?status=suspended").set(auth(admin.token))).body.items;
    expect(list.map((u: { id: string }) => u.id)).toEqual([user.user.id]);
    await api().post(`/v1/admin/usuarios/${user.user.id}/suspensao`).set(auth(admin.token)).send({ suspended: false, reason: "Revisado" }).expect(204);
    await api().post("/v1/auth/login").send({ email: user.user.email, password: user.password }).expect(200);
    await api().post(`/v1/admin/usuarios/${admin.user.id}/suspensao`).set(auth(admin.token)).send({ suspended: true, reason: "Teste" }).expect(400);
  });

  it("aviso global aparece para todos e pode notificar em lote", async () => {
    const admin = await createAdmin();
    const u1 = await createUser();
    await api().post("/v1/admin/avisos").set(auth(admin.token)).send({ title: "Manutenção no domingo", body: "Das 2h às 3h", level: "warning", notify: true }).expect(201);
    const active = (await api().get("/v1/suporte/avisos").set(auth(u1.token)).expect(200)).body.announcements;
    expect(active[0]).toMatchObject({ title: "Manutenção no domingo", level: "warning" });
    await runPendingJobs(50);
    expect(await notifications(u1.user.id, "admin.announcement")).toHaveLength(1);
    await api().post(`/v1/admin/avisos/${active[0].id}/encerrar`).set(auth(admin.token)).expect(204);
    expect((await api().get("/v1/suporte/avisos").set(auth(u1.token))).body.announcements).toHaveLength(0);
  });

  it("status dos serviços e mensagens de contato", async () => {
    const admin = await createAdmin();
    await api().post("/v1/contato").send({ name: "Carla", email: "carla@x.dev", subject: "Planos", message: "Quero conhecer o Business" }).expect(202);
    const status = (await api().get("/v1/admin/status").set(auth(admin.token)).expect(200)).body;
    expect(status.database.ok).toBe(true);
    const contacts = (await api().get("/v1/admin/contatos").set(auth(admin.token))).body.messages;
    expect(contacts[0]).toMatchObject({ name: "Carla", handledAt: null });
    await api().post(`/v1/admin/contatos/${contacts[0].id}/atendido`).set(auth(admin.token)).send({}).expect(204);
  });
});

describe("central de suporte", () => {
  it("cliente abre chamado, equipe responde e muda status; cliente vê só os próprios", async () => {
    const admin = await createAdmin();
    const client = await createUser({ name: "Caio Cliente" });
    const other = await createUser();
    const created = (
      await api().post("/v1/suporte/chamados").set(auth(client.token)).send({ type: "bug", subject: "Erro ao exportar", message: "O Excel não abre no meu computador." }).expect(201)
    ).body.ticket as SupportTicket;
    expect(created).toMatchObject({ status: "open", priority: "high", messageCount: 1 });
    expect(await notifications(admin.user.id, "support.new")).toHaveLength(1);

    await api().get(`/v1/suporte/chamados/${created.id}`).set(auth(other.token)).expect(404);
    expect((await api().get("/v1/suporte/chamados").set(auth(other.token))).body.tickets).toHaveLength(0);

    await api().post(`/v1/admin/suporte/${created.id}/respostas`).set(auth(admin.token)).send({ message: "Pode enviar a versão do navegador?" }).expect(200);
    const view = (await api().get(`/v1/suporte/chamados/${created.id}`).set(auth(client.token)).expect(200)).body;
    expect(view.ticket.status).toBe("waiting_user");
    expect(view.messages[1]).toMatchObject({ isStaff: true, author: { name: "Suporte Andamo" } });
    expect(await notifications(client.user.id, "support.reply")).toHaveLength(1);

    // Resposta do cliente reabre; equipe resolve; cliente encerra.
    await api().post(`/v1/suporte/chamados/${created.id}/respostas`).set(auth(client.token)).send({ message: "Chrome 140 no Windows." }).expect(200);
    expect((await api().get(`/v1/suporte/chamados/${created.id}`).set(auth(client.token))).body.ticket.status).toBe("open");
    await api().patch(`/v1/admin/suporte/${created.id}`).set(auth(admin.token)).send({ status: "resolved" }).expect(200);
    await api().post(`/v1/suporte/chamados/${created.id}/encerrar`).set(auth(client.token)).expect(200);
    await api().post(`/v1/suporte/chamados/${created.id}/respostas`).set(auth(client.token)).send({ message: "Mais uma coisa" }).expect(400);

    const queue = (await api().get("/v1/admin/suporte?status=active").set(auth(admin.token))).body.tickets;
    expect(queue).toHaveLength(0);
  });
});
