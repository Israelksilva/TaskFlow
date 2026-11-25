import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../src/db";
import { isQuiet } from "../src/modules/notifications/notification.service";
import {
  addMember,
  api,
  auth,
  createProject,
  createTaskV1,
  createTeamWorkspace,
  createUser,
  resetDatabase,
  runPendingJobs,
  sentMail,
  sentPushes,
} from "./helpers";

beforeEach(resetDatabase);

async function team() {
  const owner = await createUser({ name: "Olga Dona" });
  const member = await createUser({ name: "Mateus Membro" });
  const ws = await createTeamWorkspace(owner.token);
  await addMember(owner.token, ws.id, member);
  const project = await createProject(owner.token, ws.id);
  // Remove as notificações do próprio setup (convite recebido, membro entrou).
  await db.query(`DELETE FROM notifications`);
  return { owner, member, ws, project };
}

const list = async (token: string, q = "") => (await api().get(`/v1/notificacoes${q}`).set(auth(token)).expect(200)).body;

describe("notificações internas", () => {
  it("atribuição notifica o responsável (não o autor) e conta como não lida", async () => {
    const { owner, member, ws, project } = await team();
    await createTaskV1(owner.token, ws.id, { title: "Revisar contrato", projectId: project.id, assigneeIds: [member.user.id] });

    const page = await list(member.token);
    expect(page.items[0]).toMatchObject({ type: "task.assigned", body: "Revisar contrato", readAt: null });
    expect(page.items[0].link).toContain(`/app/w/${ws.id}/projetos/${project.id}?tarefa=`);
    expect((await api().get("/v1/notificacoes/contagem").set(auth(member.token))).body.unread).toBe(1);
    expect((await list(owner.token)).items.filter((n: { type: string }) => n.type === "task.assigned")).toHaveLength(0);
  });

  it("mudança de status, menção e comentário geram notificações aos interessados", async () => {
    const { owner, member, ws, project } = await team();
    const t = await createTaskV1(owner.token, ws.id, { title: "Planejar", projectId: project.id, assigneeIds: [member.user.id] });
    await api().patch(`/v1/workspaces/${ws.id}/tarefas/${t.id}`).set(auth(member.token)).send({ status: "done" }).expect(200);
    expect((await list(owner.token)).items[0]).toMatchObject({ type: "task.completed" });

    await api()
      .post(`/v1/workspaces/${ws.id}/tarefas/${t.id}/comentarios`)
      .set(auth(owner.token))
      .send({ body: `Valeu @[Mateus](${member.user.id})!` })
      .expect(201);
    const types = (await list(member.token)).items.map((n: { type: string }) => n.type);
    expect(types).toContain("mention");
    expect(types).not.toContain("comment.created"); // quem é mencionado recebe só a menção
  });

  it("marca como lida, marca todas e exclui", async () => {
    const { owner, member, ws, project } = await team();
    await createTaskV1(owner.token, ws.id, { title: "A", projectId: project.id, assigneeIds: [member.user.id] });
    await createTaskV1(owner.token, ws.id, { title: "B", projectId: project.id, assigneeIds: [member.user.id] });
    const [first] = (await list(member.token)).items;
    await api().post(`/v1/notificacoes/${first.id}/lida`).set(auth(member.token)).send({}).expect(204);
    expect((await list(member.token, "?filter=unread")).items).toHaveLength(1);
    await api().post("/v1/notificacoes/lidas").set(auth(member.token)).expect(200);
    expect((await list(member.token, "?filter=unread")).items).toHaveLength(0);
    await api().delete(`/v1/notificacoes/${first.id}`).set(auth(member.token)).expect(204);
    // Não dá para mexer na notificação de outra pessoa.
    const [second] = (await list(member.token)).items;
    await api().delete(`/v1/notificacoes/${second.id}`).set(auth(owner.token)).expect(404);
  });

  it("respeita categoria silenciada", async () => {
    const { owner, member, ws, project } = await team();
    await api().put("/v1/notificacoes/preferencias").set(auth(member.token)).send({ mutedCategories: ["tasks"] }).expect(200);
    await createTaskV1(owner.token, ws.id, { title: "Silenciada", projectId: project.id, assigneeIds: [member.user.id] });
    expect((await list(member.token)).items.filter((n: { category: string }) => n.category === "tasks")).toHaveLength(0);
  });
});

describe("entrega (push e e-mail) pela fila", () => {
  it("envia push às inscrições e e-mail para tipos importantes; remove inscrições expiradas", async () => {
    const { owner, member, ws, project } = await team();
    const sub = (endpoint: string) => ({ endpoint, keys: { p256dh: "p256dh-key-0123456789", auth: "auth-key-01" } });
    await api().post("/v1/notificacoes/push/inscricoes").set(auth(member.token)).send(sub("https://push.example/ok")).expect(201);
    await api().post("/v1/notificacoes/push/inscricoes").set(auth(member.token)).send(sub("https://push.example/expired")).expect(201);

    sentMail.length = 0;
    await createTaskV1(owner.token, ws.id, { title: "Urgente", projectId: project.id, assigneeIds: [member.user.id] });
    await runPendingJobs();
    await runPendingJobs();

    expect(sentPushes.map((p) => p.endpoint)).toEqual(expect.arrayContaining(["https://push.example/ok"]));
    expect(sentMail.some((m) => m.to === member.user.email && m.subject.includes("atribuiu"))).toBe(true);
    const { rows } = await db.query(`SELECT endpoint FROM push_subscriptions WHERE user_id = $1`, [member.user.id]);
    expect(rows.map((r) => (r as { endpoint: string }).endpoint)).toEqual(["https://push.example/ok"]);
    const logs = await db.query(`SELECT channel, status FROM delivery_logs WHERE user_id = $1`, [member.user.id]);
    expect(logs.rows.length).toBeGreaterThan(0);
  });

  it("horário silencioso e não perturbe", () => {
    const at = (iso: string) => new Date(iso);
    const prefs = { quiet_start: "22:00", quiet_end: "07:00", dnd_until: null };
    expect(isQuiet(prefs, "UTC", at("2030-01-01T23:30:00Z"))).toBe(true);
    expect(isQuiet(prefs, "UTC", at("2030-01-01T12:00:00Z"))).toBe(false);
    expect(isQuiet({ quiet_start: null, quiet_end: null, dnd_until: "2099-01-01T00:00:00Z" }, "UTC")).toBe(true);
  });
});

describe("lembretes (fila durável)", () => {
  it("agenda lembretes por responsável e reagenda quando o prazo muda", async () => {
    const { owner, member, ws, project } = await team();
    const t = await createTaskV1(owner.token, ws.id, { title: "Entrega", projectId: project.id, dueDate: "2099-06-10", dueTime: "15:00", assigneeIds: [member.user.id] });
    const pending = async () =>
      (await db.query<{ dedupe_key: string }>(`SELECT dedupe_key FROM jobs WHERE type = 'task.reminder' AND status = 'pending'`)).rows.map((r) => r.dedupe_key);
    expect(await pending()).toHaveLength(3); // padrão: 1 dia, 1 hora, no vencimento

    await api().patch(`/v1/workspaces/${ws.id}/tarefas/${t.id}`).set(auth(owner.token)).send({ dueDate: "2099-07-01" }).expect(200);
    const keys = await pending();
    expect(keys).toHaveLength(3);
    expect(keys.every((k) => k.includes("2099-07-01"))).toBe(true);

    await api().patch(`/v1/workspaces/${ws.id}/tarefas/${t.id}`).set(auth(owner.token)).send({ status: "done" }).expect(200);
    expect(await pending()).toHaveLength(0);
  });

  it("dispara o lembrete vencido e ignora lembretes obsoletos", async () => {
    const { owner, member, ws, project } = await team();
    const t = await createTaskV1(owner.token, ws.id, { title: "Hoje", projectId: project.id, dueDate: "2099-01-01", assigneeIds: [member.user.id] });
    await db.query(`UPDATE jobs SET run_at = now() - interval '1 minute' WHERE type = 'task.reminder'`);
    await runPendingJobs();
    const reminders = (await list(member.token)).items.filter((n: { type: string }) => n.type === "task.reminder");
    expect(reminders.length).toBe(3); // uma por antecedência (1 dia, 1 hora, no vencimento)
    expect(reminders.every((r: { entityId: string }) => r.entityId === t.id)).toBe(true);

    // Rodar de novo não duplica (idempotência).
    await db.query(`UPDATE jobs SET status = 'pending', run_at = now() - interval '1 minute' WHERE type = 'task.reminder'`);
    await runPendingJobs();
    expect((await list(member.token)).items.filter((n: { type: string }) => n.type === "task.reminder").length).toBe(3);
  });

  it("varredura de atrasadas notifica uma vez por tarefa e prazo", async () => {
    const { owner, member, ws, project } = await team();
    await createTaskV1(owner.token, ws.id, { title: "Velha", projectId: project.id, dueDate: new Date(Date.now() - 3 * 864e5).toISOString().slice(0, 10), assigneeIds: [member.user.id] });
    const { enqueue } = await import("../src/jobs/queue");
    await enqueue("tasks.overdue_scan", {});
    await enqueue("tasks.overdue_scan", {});
    await runPendingJobs();
    expect((await list(member.token)).items.filter((n: { type: string }) => n.type === "task.overdue")).toHaveLength(1);
  });
});
