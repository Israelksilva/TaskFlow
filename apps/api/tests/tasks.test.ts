import { beforeEach, describe, expect, it } from "vitest";
import { api, auth, createTask, createUser, layout, listTasks, resetDatabase } from "./helpers";

beforeEach(resetDatabase);

/** Usuário com três tarefas em "A Fazer" (A, B, C) e uma em "Em Progresso" (D). */
async function setup() {
  const user = await createUser();
  const a = await createTask(user.token, { title: "A" });
  const b = await createTask(user.token, { title: "B" });
  const c = await createTask(user.token, { title: "C" });
  const d = await createTask(user.token, { title: "D", status: "doing" });
  return { ...user, a, b, c, d };
}

const patch = (token: string, id: string, body: unknown) =>
  api().patch(`/tarefas/${id}`).set(auth(token)).send(body as object);

describe("POST /tarefas", () => {
  it("devolve 201 com a tarefa salva, id e Location; aparece uma única vez", async () => {
    const { token } = await createUser();
    const res = await api()
      .post("/tarefas")
      .set(auth(token))
      .send({ title: "  Nova  ", dueDate: "2030-01-15" })
      .expect(201);

    expect(res.headers.location).toBe(`/tarefas/${res.body.task.id}`);
    expect(res.body.task).toMatchObject({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      title: "Nova",
      description: null,
      priority: "media",
      status: "todo",
      position: 0,
      dueDate: "2030-01-15",
      completedAt: null,
    });

    const all = await listTasks(token);
    expect(all.filter((t) => t.id === res.body.task.id)).toHaveLength(1);
  });

  it("anexa ao final da coluna", async () => {
    const { token } = await setup();
    expect((await createTask(token, { title: "E" })).position).toBe(3);
  });

  it("valida título vazio, prioridade e data no servidor (422)", async () => {
    const { token } = await createUser();
    const res = await api()
      .post("/tarefas")
      .set(auth(token))
      .send({ title: "   ", priority: "critica", dueDate: "2026-02-31" })
      .expect(422);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(Object.keys(res.body.error.details).sort()).toEqual(["dueDate", "priority", "title"]);
    expect(res.body.error.details.title).toEqual(["Informe o título"]);
  });

  it("preenche completedAt ao criar já concluída", async () => {
    const { token } = await createUser();
    expect((await createTask(token, { title: "Feita", status: "done" })).completedAt).not.toBeNull();
  });
});

describe("PATCH /tarefas/:id — atualização parcial", () => {
  it("altera somente os campos enviados", async () => {
    const { token } = await createUser();
    const task = await createTask(token, {
      title: "Original",
      description: "Descrição mantida",
      priority: "alta",
      dueDate: "2030-05-01",
    });

    const res = await patch(token, task.id, { title: "Título novo" }).expect(200);
    expect(res.body.task).toMatchObject({
      id: task.id,
      title: "Título novo",
      description: "Descrição mantida",
      priority: "alta",
      status: "todo",
      position: 0,
      dueDate: "2030-05-01",
    });
  });

  it("limpa a data quando recebe string vazia", async () => {
    const { token } = await createUser();
    const task = await createTask(token, { title: "X", dueDate: "2030-01-01" });
    expect((await patch(token, task.id, { dueDate: "" }).expect(200)).body.task.dueDate).toBeNull();
  });

  it("rejeita corpo vazio, campos desconhecidos e título vazio", async () => {
    const { token, a } = await setup();
    await patch(token, a.id, {}).expect(422);
    await patch(token, a.id, { userId: "outro" }).expect(422);
    await patch(token, a.id, { title: "" }).expect(422);
  });

  it("404 para id inexistente ou em formato inválido", async () => {
    const { token } = await createUser();
    await patch(token, "00000000-0000-4000-8000-000000000000", { title: "x" }).expect(404);
    await patch(token, "nao-e-uuid", { title: "x" }).expect(404);
  });
});

describe("PATCH /tarefas/:id — status e posição", () => {
  it("reordena dentro da coluna e persiste", async () => {
    const { token, a } = await setup();
    await patch(token, a.id, { position: 2 }).expect(200);
    expect(layout(await listTasks(token))).toEqual(["B:todo:0", "C:todo:1", "A:todo:2", "D:doing:0"]);
  });

  it("move entre colunas mantendo posições consistentes", async () => {
    const { token, b } = await setup();
    const res = await patch(token, b.id, { status: "doing", position: 0 }).expect(200);
    expect(res.body.task).toMatchObject({ status: "doing", position: 0 });
    expect(layout(await listTasks(token))).toEqual(["A:todo:0", "C:todo:1", "B:doing:0", "D:doing:1"]);
  });

  it("só status: vai para o final da nova coluna", async () => {
    const { token, a } = await setup();
    await patch(token, a.id, { status: "doing" }).expect(200);
    expect(layout(await listTasks(token))).toEqual(["B:todo:0", "C:todo:1", "D:doing:0", "A:doing:1"]);
  });

  it("controla completedAt ao entrar e sair de Concluído", async () => {
    const { token, a } = await setup();
    const done = await patch(token, a.id, { status: "done" }).expect(200);
    expect(done.body.task.completedAt).not.toBeNull();
    const back = await patch(token, a.id, { status: "todo", position: 0 }).expect(200);
    expect(back.body.task.completedAt).toBeNull();
  });

  it("limita a posição ao tamanho da coluna", async () => {
    const { token, a } = await setup();
    expect((await patch(token, a.id, { status: "done", position: 50 })).body.task.position).toBe(0);
  });

  it("edita campos e move na mesma requisição", async () => {
    const { token, c } = await setup();
    const res = await patch(token, c.id, { title: "C2", status: "doing", position: 0 }).expect(200);
    expect(res.body.task).toMatchObject({ title: "C2", status: "doing", position: 0 });
  });
});

describe("DELETE /tarefas/:id", () => {
  it("exclui (204), compacta posições e passa a responder 404", async () => {
    const { token, a } = await setup();
    await api().delete(`/tarefas/${a.id}`).set(auth(token)).expect(204);
    await api().get(`/tarefas/${a.id}`).set(auth(token)).expect(404);
    await api().delete(`/tarefas/${a.id}`).set(auth(token)).expect(404);
    expect(layout(await listTasks(token))).toEqual(["B:todo:0", "C:todo:1", "D:doing:0"]);
  });
});

describe("GET /tarefas com filtros", () => {
  it("filtra por busca sem acento, prioridade e status", async () => {
    const { token } = await setup();
    await createTask(token, { title: "Revisão do orçamento", priority: "alta" });

    expect((await listTasks(token, "?search=orcamento")).map((t) => t.title)).toEqual(["Revisão do orçamento"]);
    expect(await listTasks(token, "?priority=alta")).toHaveLength(1);
    expect((await listTasks(token, "?status=doing")).map((t) => t.title)).toEqual(["D"]);
    await api().get("/tarefas?status=xyz").set(auth(token)).expect(422);
  });
});

describe("POST /tarefas/importar", () => {
  it("importa em lote mantendo a ordem por coluna", async () => {
    const { token } = await setup();
    const res = await api()
      .post("/tarefas/importar")
      .set(auth(token))
      .send({ tasks: [{ title: "L1" }, { title: "L2", status: "done" }, { title: "L3" }] })
      .expect(201);
    expect(res.body.tasks).toHaveLength(3);
    expect(layout(await listTasks(token))).toEqual([
      "A:todo:0", "B:todo:1", "C:todo:2", "L1:todo:3", "L3:todo:4", "D:doing:0", "L2:done:0",
    ]);
  });

  it("é atômico: um item inválido rejeita o lote inteiro", async () => {
    const { token } = await createUser();
    await api().post("/tarefas/importar").set(auth(token)).send({ tasks: [{ title: "ok" }, { title: "" }] }).expect(422);
    expect(await listTasks(token)).toEqual([]);
  });
});

describe("autorização", () => {
  it("exige login", async () => {
    await api().get("/tarefas").expect(401);
    await api().post("/tarefas").send({ title: "x" }).expect(401);
  });

  it("um usuário não vê nem altera tarefas de outro", async () => {
    const { a } = await setup();
    const intruder = await createUser();
    expect(await listTasks(intruder.token)).toEqual([]);
    await api().get(`/tarefas/${a.id}`).set(auth(intruder.token)).expect(404);
    await patch(intruder.token, a.id, { title: "x" }).expect(404);
    await api().delete(`/tarefas/${a.id}`).set(auth(intruder.token)).expect(404);
  });
});
