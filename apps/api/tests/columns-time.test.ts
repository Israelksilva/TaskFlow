import { beforeEach, describe, expect, it } from "vitest";
import type { BoardColumn, Task, TimeEntry } from "@andamo/shared";
import { db } from "../src/db";
import { addMember, api, auth, createProject, createTaskV1, createTeamWorkspace, createUser, resetDatabase } from "./helpers";

beforeEach(resetDatabase);

async function setup() {
  const owner = await createUser({ name: "Olga Dona" });
  const ws = await createTeamWorkspace(owner.token);
  const project = await createProject(owner.token, ws.id, { name: "Quadro" });
  const base = `/v1/workspaces/${ws.id}`;
  const columns = async () => (await api().get(`${base}/projetos/${project.id}/colunas`).set(auth(owner.token)).expect(200)).body.columns as BoardColumn[];
  const board = async () =>
    (await api().get(`${base}/tarefas?projectId=${project.id}`).set(auth(owner.token)).expect(200)).body.tasks as Task[];
  return { owner, ws, project, base, columns, board };
}

describe("colunas personalizáveis", () => {
  it("projeto novo nasce com as 3 colunas padrão e tarefas entram na primeira coluna da categoria", async () => {
    const { owner, ws, project, columns } = await setup();
    const cols = await columns();
    expect(cols.map((c) => `${c.name}:${c.category}`)).toEqual(["A Fazer:todo", "Em Progresso:doing", "Concluído:done"]);
    const t = await createTaskV1(owner.token, ws.id, { title: "x", projectId: project.id, status: "doing" });
    expect(t.columnId).toBe(cols[1].id);
  });

  it("cria coluna, move tarefa para ela (status = categoria) e reordena colunas", async () => {
    const { owner, ws, project, base, columns, board } = await setup();
    const review = (
      await api().post(`${base}/projetos/${project.id}/colunas`).set(auth(owner.token)).send({ name: "Revisão", category: "doing", wipLimit: 2 }).expect(201)
    ).body.column as BoardColumn;
    expect(review).toMatchObject({ position: 3, wipLimit: 2 });

    const t = await createTaskV1(owner.token, ws.id, { title: "Para revisar", projectId: project.id });
    const moved = (await api().patch(`${base}/tarefas/${t.id}`).set(auth(owner.token)).send({ columnId: review.id, position: 0 }).expect(200)).body.task;
    expect(moved).toMatchObject({ columnId: review.id, status: "doing", position: 0 });

    const ids = (await columns()).map((c) => c.id);
    const reordered = [ids[0], ids[3], ids[1], ids[2]];
    const res = await api().put(`${base}/projetos/${project.id}/colunas/ordem`).set(auth(owner.token)).send({ ids: reordered }).expect(200);
    expect(res.body.columns.map((c: BoardColumn) => c.id)).toEqual(reordered);
    await api().put(`${base}/projetos/${project.id}/colunas/ordem`).set(auth(owner.token)).send({ ids: ids.slice(1) }).expect(400);
    expect((await board()).find((x) => x.id === t.id)?.columnId).toBe(review.id);
  });

  it("mudar a categoria da coluna atualiza o status das tarefas (e completedAt)", async () => {
    const { owner, ws, project, base, columns } = await setup();
    const cols = await columns();
    const t = await createTaskV1(owner.token, ws.id, { title: "x", projectId: project.id, status: "doing" });
    await api().patch(`${base}/projetos/${project.id}/colunas/${cols[1].id}`).set(auth(owner.token)).send({ category: "done" }).expect(200);
    const after = (await api().get(`${base}/tarefas/${t.id}`).set(auth(owner.token)).expect(200)).body.task;
    expect(after.status).toBe("done");
    expect(after.completedAt).not.toBeNull();
  });

  it("excluir coluna com tarefas exige destino e preserva as tarefas no fim da coluna escolhida", async () => {
    const { owner, ws, project, base, columns, board } = await setup();
    const cols = await columns();
    await createTaskV1(owner.token, ws.id, { title: "Já feita", projectId: project.id, status: "done" });
    const a = await createTaskV1(owner.token, ws.id, { title: "A", projectId: project.id, status: "doing" });
    const url = `${base}/projetos/${project.id}/colunas/${cols[1].id}`;
    const res = await api().delete(url).set(auth(owner.token)).send({}).expect(400);
    expect(res.body.error.code).toBe("COLUMN_NOT_EMPTY");
    await api().delete(url).set(auth(owner.token)).send({ moveToColumnId: cols[2].id }).expect(204);

    const moved = (await board()).find((t) => t.id === a.id)!;
    expect(moved).toMatchObject({ columnId: cols[2].id, status: "done", position: 1 });
    expect((await columns()).map((c) => c.position)).toEqual([0, 1]);
  });

  it("status legado continua funcionando e respeita a coluna atual da mesma categoria", async () => {
    const { owner, ws, project, base } = await setup();
    const review = (await api().post(`${base}/projetos/${project.id}/colunas`).set(auth(owner.token)).send({ name: "QA", category: "doing" })).body.column;
    const t = await createTaskV1(owner.token, ws.id, { title: "x", projectId: project.id, columnId: review.id });
    expect(t).toMatchObject({ columnId: review.id, status: "doing" });
    // Mudar só a prioridade não tira a tarefa da coluna.
    const p = (await api().patch(`${base}/tarefas/${t.id}`).set(auth(owner.token)).send({ priority: "alta" }).expect(200)).body.task;
    expect(p.columnId).toBe(review.id);
    // Status "done" leva à primeira coluna de concluídas.
    const d = (await api().patch(`${base}/tarefas/${t.id}`).set(auth(owner.token)).send({ status: "done" }).expect(200)).body.task;
    expect(d.status).toBe("done");
    expect(d.columnId).not.toBe(review.id);
  });

  it("membro comum não gerencia colunas de projeto alheio; coluna de outro projeto é rejeitada", async () => {
    const { owner, ws, project, base, columns } = await setup();
    const member = await createUser();
    await addMember(owner.token, ws.id, member, "member");
    await api().post(`${base}/projetos/${project.id}/colunas`).set(auth(member.token)).send({ name: "X" }).expect(403);
    const other = await createProject(owner.token, ws.id, { name: "Outro" });
    const t = await createTaskV1(owner.token, ws.id, { title: "x", projectId: other.id });
    const res = await api().patch(`${base}/tarefas/${t.id}`).set(auth(owner.token)).send({ columnId: (await columns())[1].id }).expect(400);
    expect(res.body.error.code).toBe("INVALID_COLUMN");
  });

  it("migração 003 associou tarefas existentes às colunas da sua categoria", async () => {
    const { owner } = await setup();
    // Rotas legadas seguem usando o projeto padrão, agora com colunas.
    const t = (await api().post("/tarefas").set(auth(owner.token)).send({ title: "Legada", status: "doing" }).expect(201)).body.task;
    const { rows } = await db.query<{ category: string }>(`SELECT c.category FROM tasks t JOIN project_columns c ON c.id = t.column_id WHERE t.id = $1`, [t.id]);
    expect(rows[0].category).toBe("doing");
  });
});

describe("controle de tempo", () => {
  it("inicia, impede cronômetros simultâneos, troca de tarefa e para", async () => {
    const { owner, ws, project, base } = await setup();
    const a = await createTaskV1(owner.token, ws.id, { title: "A", projectId: project.id });
    const b = await createTaskV1(owner.token, ws.id, { title: "B", projectId: project.id });

    const started = (await api().post(`${base}/tarefas/${a.id}/tempo/iniciar`).set(auth(owner.token)).send({}).expect(201)).body.entry as TimeEntry;
    expect(started).toMatchObject({ taskId: a.id, endedAt: null, source: "timer" });
    await api().post(`${base}/tarefas/${a.id}/tempo/iniciar`).set(auth(owner.token)).send({}).expect(409);
    const conflict = await api().post(`${base}/tarefas/${b.id}/tempo/iniciar`).set(auth(owner.token)).send({}).expect(409);
    expect(conflict.body.error.code).toBe("TIMER_RUNNING");

    await api().post(`${base}/tarefas/${b.id}/tempo/iniciar`).set(auth(owner.token)).send({ switch: true }).expect(201);
    expect((await api().get("/v1/tempo/ativo").set(auth(owner.token))).body.entry.taskId).toBe(b.id);

    const stopped = (await api().post("/v1/tempo/parar").set(auth(owner.token)).expect(200)).body.entry as TimeEntry;
    expect(stopped.endedAt).not.toBeNull();
    expect((await api().get("/v1/tempo/ativo").set(auth(owner.token))).body.entry).toBeNull();
    const { rows } = await db.query(`SELECT 1 FROM time_entries WHERE ended_at IS NULL`);
    expect(rows).toHaveLength(0);
  });

  it("o banco garante um único cronômetro por pessoa (índice único)", async () => {
    const { owner, ws, project } = await setup();
    const a = await createTaskV1(owner.token, ws.id, { title: "A", projectId: project.id });
    const insert = () =>
      db.query(`INSERT INTO time_entries (workspace_id, task_id, user_id, started_at) VALUES ($1, $2, $3, now())`, [ws.id, a.id, owner.user.id]);
    await insert();
    await expect(insert()).rejects.toThrow();
  });

  it("registro manual, soma na tarefa, resumo estimado × realizado e por projeto/pessoa", async () => {
    const { owner, ws, project, base } = await setup();
    const t = await createTaskV1(owner.token, ws.id, { title: "Relatório", projectId: project.id, estimateMinutes: 120 });
    const startedAt = new Date(Date.now() - 3 * 3600e3).toISOString();
    await api().post(`${base}/tarefas/${t.id}/tempo`).set(auth(owner.token)).send({ startedAt, minutes: 90, note: "Rascunho" }).expect(201);
    await api().post(`${base}/tarefas/${t.id}/tempo`).set(auth(owner.token)).send({ startedAt, minutes: 0 }).expect(422);
    await api().post(`${base}/tarefas/${t.id}/tempo`).set(auth(owner.token)).send({ startedAt: new Date(Date.now() + 864e5).toISOString(), minutes: 10 }).expect(400);

    const task = (await api().get(`${base}/tarefas/${t.id}`).set(auth(owner.token))).body.task;
    expect(task.trackedSeconds).toBe(5400);

    const today = new Date().toISOString().slice(0, 10);
    const from = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
    const sum = (await api().get(`${base}/tempo/resumo?from=${from}&to=${today}`).set(auth(owner.token)).expect(200)).body;
    expect(sum.totalSeconds).toBe(5400);
    expect(sum.byProject[0]).toMatchObject({ projectId: project.id, seconds: 5400 });
    expect(sum.byUser[0].user.id).toBe(owner.user.id);
    expect(sum.byTask[0]).toMatchObject({ taskId: t.id, estimateMinutes: 120, trackedSeconds: 5400 });

    const entries = (await api().get(`${base}/tempo?from=${from}&to=${today}&userId=me`).set(auth(owner.token)).expect(200)).body.entries;
    expect(entries).toHaveLength(1);
    await api().patch(`${base}/tempo/${entries[0].id}`).set(auth(owner.token)).send({ minutes: 60 }).expect(200);
    expect((await api().get(`${base}/tarefas/${t.id}`).set(auth(owner.token))).body.task.trackedSeconds).toBe(3600);
  });

  it("só o autor (ou gestor) altera registros; isolamento entre workspaces", async () => {
    const { owner, ws, project, base } = await setup();
    const member = await createUser();
    await addMember(owner.token, ws.id, member, "member");
    const t = await createTaskV1(owner.token, ws.id, { title: "T", projectId: project.id });
    const entry = (await api().post(`${base}/tarefas/${t.id}/tempo`).set(auth(owner.token)).send({ startedAt: new Date(Date.now() - 3600e3).toISOString(), minutes: 30 })).body.entry;
    await api().delete(`${base}/tempo/${entry.id}`).set(auth(member.token)).expect(403);

    const outsider = await createUser();
    const outsiderWs = (await api().get("/v1/workspaces").set(auth(outsider.token))).body.workspaces[0];
    await api().delete(`/v1/workspaces/${outsiderWs.id}/tempo/${entry.id}`).set(auth(outsider.token)).expect(404);
    await api().post(`/v1/workspaces/${outsiderWs.id}/tarefas/${t.id}/tempo/iniciar`).set(auth(outsider.token)).send({}).expect(404);
    await api().delete(`${base}/tempo/${entry.id}`).set(auth(owner.token)).expect(204);
  });
});
