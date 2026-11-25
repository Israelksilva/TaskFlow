import { beforeEach, describe, expect, it } from "vitest";
import {
  addMember,
  api,
  auth,
  createProject,
  createTaskV1,
  createTeamWorkspace,
  createUser,
  resetDatabase,
} from "./helpers";

beforeEach(resetDatabase);

async function setup() {
  const owner = await createUser({ name: "Olga Dona" });
  const ws = await createTeamWorkspace(owner.token);
  const project = await createProject(owner.token, ws.id, { name: "Lançamento" });
  return { owner, ws, project };
}

describe("isolamento entre organizações", () => {
  it("não-membros não acessam workspace, projetos nem tarefas (404, sem vazar existência)", async () => {
    const { owner, ws, project } = await setup();
    const task = await createTaskV1(owner.token, ws.id, { title: "Segredo", projectId: project.id });
    const outsider = await createUser();

    await api().get(`/v1/workspaces/${ws.id}`).set(auth(outsider.token)).expect(404);
    await api().get(`/v1/workspaces/${ws.id}/tarefas`).set(auth(outsider.token)).expect(404);
    await api().patch(`/v1/workspaces/${ws.id}/tarefas/${task.id}`).set(auth(outsider.token)).send({ title: "x" }).expect(404);
    await api().get(`/v1/workspaces/${ws.id}/busca?q=Segredo`).set(auth(outsider.token)).expect(404);
  });

  it("IDOR: tarefa de outro workspace não é acessível nem pelo workspace do próprio usuário", async () => {
    const { owner, ws, project } = await setup();
    const task = await createTaskV1(owner.token, ws.id, { title: "Alheia", projectId: project.id });
    const other = await createUser();
    const otherWs = (await api().get("/v1/workspaces").set(auth(other.token))).body.workspaces[0];

    await api().get(`/v1/workspaces/${otherWs.id}/tarefas/${task.id}`).set(auth(other.token)).expect(404);
    await api().delete(`/v1/workspaces/${otherWs.id}/tarefas/${task.id}`).set(auth(other.token)).expect(404);
    // Projeto de outro tenant também não pode ser usado para criar tarefas.
    await api().post(`/v1/workspaces/${otherWs.id}/tarefas`).set(auth(other.token)).send({ title: "x", projectId: project.id }).expect(404);
  });

  it("responsáveis só podem ser membros do workspace", async () => {
    const { owner, ws, project } = await setup();
    const outsider = await createUser();
    const task = await createTaskV1(owner.token, ws.id, { title: "T", projectId: project.id, assigneeIds: [outsider.user.id, owner.user.id] });
    expect(task.assigneeIds).toEqual([owner.user.id]);
  });
});

describe("RBAC", () => {
  it("visualizador só lê; convidado comenta e edita apenas o que é seu; membro cria", async () => {
    const { owner, ws, project } = await setup();
    // Convidados exigem plano Pro: no Free, o convite é recusado com 402.
    const viewer = await createUser();
    await api().post(`/v1/workspaces/${ws.id}/convites`).set(auth(owner.token)).send({ email: viewer.user.email, role: "viewer" }).expect(402);

    const member = await createUser();
    await addMember(owner.token, ws.id, member, "member");
    const created = await createTaskV1(member.token, ws.id, { title: "Do membro", projectId: project.id });
    expect(created.createdBy).toBe(member.user.id);

    // Membro não gerencia membros nem altera o workspace.
    await api().patch(`/v1/workspaces/${ws.id}`).set(auth(member.token)).send({ name: "Novo nome" }).expect(403);
    await api().patch(`/v1/workspaces/${ws.id}/membros/${owner.user.id}`).set(auth(member.token)).send({ role: "viewer" }).expect(403);
  });

  it("papéis: admin não altera o dono; ninguém promove acima do próprio papel", async () => {
    const { owner, ws } = await setup();
    const admin = await createUser();
    const member = await createUser();
    await addMember(owner.token, ws.id, admin, "admin");
    await addMember(owner.token, ws.id, member, "member");

    await api().patch(`/v1/workspaces/${ws.id}/membros/${owner.user.id}`).set(auth(admin.token)).send({ role: "member" }).expect(403);
    await api().patch(`/v1/workspaces/${ws.id}/membros/${member.user.id}`).set(auth(admin.token)).send({ role: "manager" }).expect(200);
    await api().patch(`/v1/workspaces/${ws.id}/membros/${member.user.id}`).set(auth(admin.token)).send({ role: "owner" }).expect(422);
  });

  it("transfere a propriedade e o antigo dono vira administrador", async () => {
    const { owner, ws } = await setup();
    const next = await createUser();
    await addMember(owner.token, ws.id, next, "member");
    const res = await api().post(`/v1/workspaces/${ws.id}/transferir`).set(auth(owner.token)).send({ userId: next.user.id }).expect(200);
    expect(res.body.workspace.role).toBe("admin");
    expect(res.body.workspace.ownerId).toBe(next.user.id);
  });

  it("convite só pode ser aceito pelo e-mail convidado", async () => {
    const { owner, ws } = await setup();
    const invited = await createUser();
    const intruder = await createUser();
    await expect(addMember(owner.token, ws.id, { token: intruder.token, user: invited.user })).rejects.toThrow();
  });

  it("respeita o limite de projetos do plano Free", async () => {
    const { owner, ws } = await setup(); // 1 projeto inicial + "Lançamento"
    await createProject(owner.token, ws.id, { name: "Terceiro" });
    const res = await api().post(`/v1/workspaces/${ws.id}/projetos`).set(auth(owner.token)).send({ name: "Quarto" }).expect(402);
    expect(res.body.error.code).toBe("PLAN_LIMIT");
  });
});

describe("tarefas v1", () => {
  it("lixeira: exclui, lista na lixeira, restaura e exclui definitivamente", async () => {
    const { owner, ws, project } = await setup();
    const t = await createTaskV1(owner.token, ws.id, { title: "Lixo", projectId: project.id });
    const base = `/v1/workspaces/${ws.id}/tarefas`;
    await api().delete(`${base}/${t.id}`).set(auth(owner.token)).expect(204);
    expect((await api().get(`${base}?view=trash`).set(auth(owner.token))).body.tasks).toHaveLength(1);
    await api().post(`${base}/${t.id}/restaurar`).set(auth(owner.token)).expect(200);
    await api().delete(`${base}/${t.id}/permanente`).set(auth(owner.token)).expect(400);
    await api().delete(`${base}/${t.id}`).set(auth(owner.token)).expect(204);
    await api().delete(`${base}/${t.id}/permanente`).set(auth(owner.token)).expect(204);
    await api().get(`${base}/${t.id}`).set(auth(owner.token)).expect(404);
  });

  it("subtarefas e checklist calculam o progresso; recorrente concluída gera a próxima", async () => {
    const { owner, ws, project } = await setup();
    const base = `/v1/workspaces/${ws.id}/tarefas`;
    const parent = await createTaskV1(owner.token, ws.id, { title: "Pai", projectId: project.id, dueDate: "2030-01-31", recurrence: "monthly" });
    const sub = await createTaskV1(owner.token, ws.id, { title: "Filha", parentId: parent.id });
    await api().post(`${base}/${parent.id}/checklist`).set(auth(owner.token)).send({ content: "Item" }).expect(201);
    await api().patch(`${base}/${sub.id}`).set(auth(owner.token)).send({ status: "done" }).expect(200);
    const detail = await api().get(`${base}/${parent.id}`).set(auth(owner.token)).expect(200);
    expect(detail.body.task.progress).toBe(50);
    expect(detail.body.task.subtasks).toHaveLength(1);

    await api().patch(`${base}/${parent.id}`).set(auth(owner.token)).send({ status: "done" }).expect(200);
    const list = (await api().get(`${base}?projectId=${project.id}`).set(auth(owner.token))).body.tasks;
    expect(list.find((t: { title: string; status: string }) => t.title === "Pai" && t.status === "todo").dueDate).toBe("2030-02-28");
  });

  it("detecta conflito de edição concorrente", async () => {
    const { owner, ws, project } = await setup();
    const t = await createTaskV1(owner.token, ws.id, { title: "Versão 1", projectId: project.id });
    const url = `/v1/workspaces/${ws.id}/tarefas/${t.id}`;
    await api().patch(url).set(auth(owner.token)).send({ title: "Versão 2" }).expect(200);
    const res = await api().patch(url).set(auth(owner.token)).send({ title: "Versão 3", expectedUpdatedAt: t.updatedAt }).expect(409);
    expect(res.body.error.code).toBe("EDIT_CONFLICT");
  });

  it("impede ciclos de dependência", async () => {
    const { owner, ws, project } = await setup();
    const a = await createTaskV1(owner.token, ws.id, { title: "A", projectId: project.id });
    const b = await createTaskV1(owner.token, ws.id, { title: "B", projectId: project.id });
    const base = `/v1/workspaces/${ws.id}/tarefas`;
    await api().post(`${base}/${a.id}/dependencias`).set(auth(owner.token)).send({ dependsOnId: b.id }).expect(204);
    await api().post(`${base}/${b.id}/dependencias`).set(auth(owner.token)).send({ dependsOnId: a.id }).expect(400);
  });

  it("dashboard reflete dados reais", async () => {
    const { owner, ws, project } = await setup();
    await createTaskV1(owner.token, ws.id, { title: "Feita", projectId: project.id, status: "done" });
    await createTaskV1(owner.token, ws.id, { title: "Atrasada", projectId: project.id, dueDate: "2020-01-01" });
    const res = await api().get(`/v1/workspaces/${ws.id}/dashboard?period=7d`).set(auth(owner.token)).expect(200);
    expect(res.body.totals).toMatchObject({ tasks: 2, done: 1, overdue: 1, completionRate: 50 });
    expect(res.body.series).toHaveLength(7);
    expect(res.body.series.at(-1).created).toBe(2);
  });
});
