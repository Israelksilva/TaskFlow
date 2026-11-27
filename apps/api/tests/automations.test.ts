import { beforeEach, describe, expect, it } from "vitest";
import type { Automation, AutomationRun, BoardColumn, Task } from "@andamo/shared";
import { db } from "../src/db";
import { enqueue } from "../src/jobs/queue";
import { addMember, api, auth, createProject, createTaskV1, createTeamWorkspace, createUser, resetDatabase, runPendingJobs } from "./helpers";

beforeEach(resetDatabase);

/** Processa a fila até esvaziar (automações podem gerar novos eventos). */
async function drain() {
  for (let i = 0; i < 15; i++) if ((await runPendingJobs(50)) === 0) return;
}

async function setup() {
  const owner = await createUser({ name: "Olga Gestora" });
  const member = await createUser({ name: "Mateus Membro" });
  const ws = await createTeamWorkspace(owner.token);
  await addMember(owner.token, ws.id, member, "member");
  const project = await createProject(owner.token, ws.id, { name: "Operação" });
  const base = `/v1/workspaces/${ws.id}`;
  const columns = (await api().get(`${base}/projetos/${project.id}/colunas`).set(auth(owner.token))).body.columns as BoardColumn[];
  const create = async (body: Record<string, unknown>) =>
    (await api().post(`${base}/automacoes`).set(auth(owner.token)).send({ projectId: project.id, ...body }).expect(201)).body.automation as Automation;
  const task = async (id: string) => (await api().get(`${base}/tarefas/${id}`).set(auth(owner.token))).body.task as Task;
  const runs = async () => (await api().get(`${base}/automacoes/execucoes`).set(auth(owner.token))).body.runs as AutomationRun[];
  await db.query(`DELETE FROM notifications`);
  return { owner, member, ws, project, base, columns, create, task, runs };
}

const notificationsOf = async (userId: string, type: string) =>
  (await db.query(`SELECT title FROM notifications WHERE user_id = $1 AND type = $2`, [userId, type])).rows as Array<{ title: string }>;

describe("automações", () => {
  it("tarefa concluída → notifica os gestores", async () => {
    const { owner, member, ws, project, base, create } = await setup();
    await create({ name: "Avisar gestão", trigger: "task.completed", actions: [{ type: "notify", target: "managers" }] });
    const t = await createTaskV1(member.token, ws.id, { title: "Entregar relatório", projectId: project.id });
    await api().patch(`${base}/tarefas/${t.id}`).set(auth(member.token)).send({ status: "done" }).expect(200);
    await drain();
    const n = await notificationsOf(owner.user.id, "automation");
    expect(n).toHaveLength(1);
    expect(n[0].title).toContain("Entregar relatório");
  });

  it("nova tarefa → atribui automaticamente; condições de prioridade filtram", async () => {
    const { member, owner, ws, project, create, task } = await setup();
    await create({ name: "Triagem", trigger: "task.created", conditions: { priorities: ["urgente"] }, actions: [{ type: "assign", userId: member.user.id }] });
    const urgent = await createTaskV1(owner.token, ws.id, { title: "Incidente", projectId: project.id, priority: "urgente" });
    const normal = await createTaskV1(owner.token, ws.id, { title: "Rotina", projectId: project.id });
    await drain();
    expect((await task(urgent.id)).assigneeIds).toEqual([member.user.id]);
    expect((await task(normal.id)).assigneeIds).toEqual([]);
  });

  it("subtarefas concluídas → conclui a tarefa principal", async () => {
    const { owner, ws, project, base, create, task } = await setup();
    await create({ name: "Fechar pai", trigger: "subtasks.completed", actions: [{ type: "complete_parent" }] });
    const parent = await createTaskV1(owner.token, ws.id, { title: "Pai", projectId: project.id });
    const s1 = await createTaskV1(owner.token, ws.id, { title: "S1", parentId: parent.id });
    const s2 = await createTaskV1(owner.token, ws.id, { title: "S2", parentId: parent.id });
    await api().patch(`${base}/tarefas/${s1.id}`).set(auth(owner.token)).send({ status: "done" }).expect(200);
    await drain();
    expect((await task(parent.id)).status).toBe("todo");
    await api().patch(`${base}/tarefas/${s2.id}`).set(auth(owner.token)).send({ status: "done" }).expect(200);
    await drain();
    expect((await task(parent.id)).status).toBe("done");
  });

  it("mudança de coluna → define prioridade (condição de coluna de destino)", async () => {
    const { owner, ws, project, base, columns, create, task } = await setup();
    await create({ name: "Urgência em andamento", trigger: "task.moved", conditions: { toColumnId: columns[1].id }, actions: [{ type: "set_priority", priority: "alta" }] });
    const t = await createTaskV1(owner.token, ws.id, { title: "X", projectId: project.id });
    await api().patch(`${base}/tarefas/${t.id}`).set(auth(owner.token)).send({ columnId: columns[1].id }).expect(200);
    await drain();
    expect((await task(t.id)).priority).toBe("alta");
  });

  it("evita loop infinito entre automações que se disparam mutuamente", async () => {
    const { owner, ws, project, base, columns, create, task, runs } = await setup();
    const review = (await api().post(`${base}/projetos/${project.id}/colunas`).set(auth(owner.token)).send({ name: "Revisão", category: "doing" })).body.column as BoardColumn;
    const doing = columns[1];
    await create({ name: "Auto A", trigger: "task.moved", conditions: { toColumnId: review.id }, actions: [{ type: "move_to_column", columnId: doing.id }] });
    await create({ name: "Auto B", trigger: "task.moved", conditions: { toColumnId: doing.id }, actions: [{ type: "move_to_column", columnId: review.id }] });
    const t = await createTaskV1(owner.token, ws.id, { title: "Pingue-pongue", projectId: project.id });
    await api().patch(`${base}/tarefas/${t.id}`).set(auth(owner.token)).send({ columnId: review.id }).expect(200);
    await drain();

    const all = await runs();
    expect(all.filter((r) => r.status === "success").map((r) => r.automationName).sort()).toEqual(["Auto A", "Auto B"]);
    expect(all.some((r) => r.status === "skipped" && r.detail?.includes("evitar loop"))).toBe(true);
    expect((await task(t.id)).columnId).toBe(review.id);
    // Nada pendente: a cadeia terminou.
    const { rows } = await db.query(`SELECT 1 FROM jobs WHERE status = 'pending' AND type = 'automation.evaluate'`);
    expect(rows).toHaveLength(0);
  });

  it("falha é registrada no histórico e o criador é avisado", async () => {
    const { owner, ws, project, base, create, runs } = await setup();
    const extra = (await api().post(`${base}/projetos/${project.id}/colunas`).set(auth(owner.token)).send({ name: "Temporária", category: "todo" })).body.column as BoardColumn;
    const auto = await create({ name: "Mover nova", trigger: "task.created", actions: [{ type: "move_to_column", columnId: extra.id }] });
    await api().delete(`${base}/projetos/${project.id}/colunas/${extra.id}`).set(auth(owner.token)).send({}).expect(204);
    await createTaskV1(owner.token, ws.id, { title: "Y", projectId: project.id });
    await drain();
    const failed = (await runs()).find((r) => r.automationId === auto.id)!;
    expect(failed.status).toBe("failed");
    expect(await notificationsOf(owner.user.id, "automation.failed")).toHaveLength(1);
    const list = (await api().get(`${base}/automacoes`).set(auth(owner.token))).body.automations as Automation[];
    expect(list[0].lastError).toContain("Coluna inválida");
  });

  it("tarefa atrasada → notifica responsáveis (via varredura), uma vez por prazo", async () => {
    const { owner, member, ws, project, create } = await setup();
    await create({ name: "Cobrar atraso", trigger: "task.overdue", actions: [{ type: "notify", target: "assignees", message: "Tarefa atrasada" }] });
    await createTaskV1(owner.token, ws.id, { title: "Velha", projectId: project.id, dueDate: new Date(Date.now() - 3 * 864e5).toISOString().slice(0, 10), assigneeIds: [member.user.id] });
    await enqueue("tasks.overdue_automations", {});
    await drain();
    await enqueue("tasks.overdue_automations", {});
    await drain();
    expect(await notificationsOf(member.user.id, "automation")).toHaveLength(1);
  });

  it("permissões, referências do workspace, ativar/desativar e limite do plano Free (3)", async () => {
    const { owner, member, base, project, create } = await setup();
    const body = { name: "Geral", projectId: project.id, trigger: "task.created", actions: [{ type: "notify", target: "managers" }] };
    const url = `${base}/automacoes`;
    await api().post(url).set(auth(member.token)).send(body).expect(403);

    const outsider = await createUser();
    const bad = await api()
      .post(url)
      .set(auth(owner.token))
      .send({ ...body, actions: [{ type: "notify", target: "user", userId: outsider.user.id }] })
      .expect(400);
    expect(bad.body.error.message).toContain("não é membro");

    const a1 = await create({ name: "Um", trigger: "task.created", actions: [{ type: "notify", target: "managers" }] });
    const off = await api().patch(`${url}/${a1.id}`).set(auth(owner.token)).send({ enabled: false }).expect(200);
    expect(off.body.automation.enabled).toBe(false);
    await create({ name: "Dois", trigger: "task.created", actions: [{ type: "notify", target: "managers" }] });
    await create({ name: "Três", trigger: "task.created", actions: [{ type: "notify", target: "managers" }] });
    const limit = await api().post(url).set(auth(owner.token)).send(body).expect(402);
    expect(limit.body.error.code).toBe("PLAN_LIMIT");
  });
});
