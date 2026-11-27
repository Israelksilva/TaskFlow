import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "../src/config/env";
import { db } from "../src/db";
import { api, auth, createProject, createTaskV1, createTeamWorkspace, createUser, resetDatabase, runPendingJobs } from "./helpers";

/** R2 simulado em memória: nenhuma chamada sai da máquina. */
let objects: Map<string, number>;
let deleted: string[];
const realFetch = globalThis.fetch;

function keyFrom(url: string) {
  const u = new URL(url);
  expect(u.hostname).toBe("conta-teste.r2.cloudflarestorage.com");
  expect(u.searchParams.get("X-Amz-Signature")).toMatch(/^[0-9a-f]{64}$/);
  return decodeURIComponent(u.pathname.replace(/^\/andamo-teste\//, ""));
}

beforeEach(async () => {
  await resetDatabase();
  await db.query("DELETE FROM attachments");
  objects = new Map();
  deleted = [];
  Object.assign(env, { R2_ACCOUNT_ID: "conta-teste", R2_ACCESS_KEY_ID: "AKTESTE", R2_SECRET_ACCESS_KEY: "segredo-teste", R2_BUCKET: "andamo-teste" });
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    if (!url.includes(".r2.cloudflarestorage.com")) return realFetch(input, init);
    const key = keyFrom(url);
    if (init?.method === "HEAD") return objects.has(key) ? new Response(null, { status: 200, headers: { "content-length": String(objects.get(key)) } }) : new Response(null, { status: 404 });
    if (init?.method === "DELETE") {
      deleted.push(key);
      objects.delete(key);
      return new Response(null, { status: 204 });
    }
    return new Response(null, { status: 400 });
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  Object.assign(env, { R2_ACCOUNT_ID: undefined, R2_ACCESS_KEY_ID: undefined, R2_SECRET_ACCESS_KEY: undefined, R2_BUCKET: undefined });
});

/** Simula o navegador enviando o arquivo para a URL pré-assinada. */
const uploadTo = (uploadUrl: string, size: number) => objects.set(keyFrom(uploadUrl), size);

async function setup() {
  const owner = await createUser({ name: "Olga Dona" });
  const ws = await createTeamWorkspace(owner.token);
  const project = await createProject(owner.token, ws.id, { name: "Obra" });
  const task = await createTaskV1(owner.token, ws.id, { title: "Planta baixa", projectId: project.id });
  return { owner, ws, project, task };
}

describe("arquivos (Cloudflare R2 privado)", () => {
  it("sem R2 configurado: indisponível (503), sem simular", async () => {
    Object.assign(env, { R2_BUCKET: undefined });
    const { owner, ws, project } = await setup();
    const res = await api().post(`/v1/workspaces/${ws.id}/arquivos`).set(auth(owner.token)).send({ projectId: project.id, fileName: "a.pdf", contentType: "application/pdf", sizeBytes: 10 });
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("STORAGE_NOT_CONFIGURED");
    expect((await api().get(`/v1/workspaces/${ws.id}/arquivos/uso`).set(auth(owner.token))).body.available).toBe(false);
  });

  it("envio em duas etapas, download assinado curto e exclusão no bucket", async () => {
    const { owner, ws, project, task } = await setup();
    const created = await api().post(`/v1/workspaces/${ws.id}/arquivos`).set(auth(owner.token))
      .send({ projectId: project.id, taskId: task.id, fileName: "Orçamento final.pdf", contentType: "application/pdf", sizeBytes: 2048 }).expect(201);
    expect(created.body.method).toBe("PUT");
    expect(new URL(created.body.uploadUrl).searchParams.get("X-Amz-Expires")).toBe("900");
    expect(created.body.uploadUrl).not.toContain("Or%C3%A7amento"); // a chave não carrega o nome

    // Antes de concluir, não aparece; concluir sem o arquivo no bucket falha.
    expect((await api().get(`/v1/workspaces/${ws.id}/arquivos?taskId=${task.id}`).set(auth(owner.token))).body.attachments).toHaveLength(0);
    await api().post(`/v1/workspaces/${ws.id}/arquivos/${created.body.id}/concluir`).set(auth(owner.token)).expect(400);

    uploadTo(created.body.uploadUrl, 2048);
    const done = await api().post(`/v1/workspaces/${ws.id}/arquivos/${created.body.id}/concluir`).set(auth(owner.token)).expect(200);
    expect(done.body.attachment).toMatchObject({ fileName: "Orçamento final.pdf", sizeBytes: 2048, taskId: task.id });
    expect((await api().get(`/v1/workspaces/${ws.id}/arquivos?projectId=${project.id}`).set(auth(owner.token))).body.attachments).toHaveLength(1);

    const dl = await api().get(`/v1/workspaces/${ws.id}/arquivos/${created.body.id}/download`).set(auth(owner.token)).expect(200);
    const u = new URL(dl.body.url);
    expect(u.searchParams.get("X-Amz-Expires")).toBe("60");
    expect(u.searchParams.get("response-content-disposition")).toMatch(/^attachment; filename="Or_amento final.pdf"; filename\*=UTF-8''Or%C3%A7amento%20final\.pdf$/);

    expect((await api().get(`/v1/workspaces/${ws.id}/arquivos/uso`).set(auth(owner.token))).body).toMatchObject({ available: true, usedBytes: 2048, limitBytes: 100 * 1024 * 1024 });

    await api().delete(`/v1/workspaces/${ws.id}/arquivos/${created.body.id}`).set(auth(owner.token)).expect(204);
    await api().get(`/v1/workspaces/${ws.id}/arquivos/${created.body.id}/download`).set(auth(owner.token)).expect(404);
    await runPendingJobs(10);
    expect(deleted).toHaveLength(1);
  });

  it("tamanho divergente é rejeitado e o objeto é removido", async () => {
    const { owner, ws, project } = await setup();
    const c = await api().post(`/v1/workspaces/${ws.id}/arquivos`).set(auth(owner.token)).send({ projectId: project.id, fileName: "x.png", contentType: "image/png", sizeBytes: 100 }).expect(201);
    uploadTo(c.body.uploadUrl, 999_999);
    const res = await api().post(`/v1/workspaces/${ws.id}/arquivos/${c.body.id}/concluir`).set(auth(owner.token)).expect(400);
    expect(res.body.error.code).toBe("UPLOAD_SIZE_MISMATCH");
    await runPendingJobs(10);
    expect(deleted).toHaveLength(1);
  });

  it("permissões: outro workspace não vê (404); visualizador baixa mas não envia; executáveis e limite do plano bloqueados", async () => {
    const { owner, ws, project, task } = await setup();
    const c = await api().post(`/v1/workspaces/${ws.id}/arquivos`).set(auth(owner.token)).send({ projectId: project.id, taskId: task.id, fileName: "a.txt", contentType: "text/plain", sizeBytes: 5 }).expect(201);
    uploadTo(c.body.uploadUrl, 5);
    await api().post(`/v1/workspaces/${ws.id}/arquivos/${c.body.id}/concluir`).set(auth(owner.token)).expect(200);

    // Estranho ao workspace: nem lista nem baixa (o workspace inteiro é 404 para não-membros).
    const stranger = await createUser();
    await api().get(`/v1/workspaces/${ws.id}/arquivos/${c.body.id}/download`).set(auth(stranger.token)).expect(404);
    // Mesmo com o id do arquivo, a partir do próprio workspace também não encontra.
    const strangerWs = await createTeamWorkspace(stranger.token, "Outro");
    await api().get(`/v1/workspaces/${strangerWs.id}/arquivos/${c.body.id}/download`).set(auth(stranger.token)).expect(404);

    const viewer = await createUser();
    // Visualizadores exigem plano pago no convite; aqui o vínculo é criado direto para isolar a regra de arquivos.
    await db.query(`INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'viewer')`, [ws.id, viewer.user.id]);
    await api().get(`/v1/workspaces/${ws.id}/arquivos/${c.body.id}/download`).set(auth(viewer.token)).expect(200);
    await api().post(`/v1/workspaces/${ws.id}/arquivos`).set(auth(viewer.token)).send({ projectId: project.id, fileName: "b.txt", contentType: "text/plain", sizeBytes: 5 }).expect(403);
    await api().delete(`/v1/workspaces/${ws.id}/arquivos/${c.body.id}`).set(auth(viewer.token)).expect(403);

    await api().post(`/v1/workspaces/${ws.id}/arquivos`).set(auth(owner.token)).send({ projectId: project.id, fileName: "virus.exe", contentType: "application/octet-stream", sizeBytes: 5 }).expect(422);
    const big = await api().post(`/v1/workspaces/${ws.id}/arquivos`).set(auth(owner.token)).send({ projectId: project.id, fileName: "a.zip", contentType: "application/zip", sizeBytes: 50 * 1024 * 1024 });
    expect(big.status).toBe(201); // 50 MB cabe nos 100 MB do Free
    const over = await api().post(`/v1/workspaces/${ws.id}/arquivos`).set(auth(owner.token)).send({ projectId: project.id, fileName: "b.zip", contentType: "application/zip", sizeBytes: 50 * 1024 * 1024 });
    expect(over.status).toBe(402);
  });

  it("tarefa na lixeira esconde os anexos; exclusão definitiva remove do bucket", async () => {
    const { owner, ws, project, task } = await setup();
    const c = await api().post(`/v1/workspaces/${ws.id}/arquivos`).set(auth(owner.token)).send({ projectId: project.id, taskId: task.id, fileName: "a.txt", contentType: "text/plain", sizeBytes: 5 }).expect(201);
    uploadTo(c.body.uploadUrl, 5);
    await api().post(`/v1/workspaces/${ws.id}/arquivos/${c.body.id}/concluir`).set(auth(owner.token)).expect(200);

    await api().delete(`/v1/workspaces/${ws.id}/tarefas/${task.id}`).set(auth(owner.token)).expect(204);
    await api().get(`/v1/workspaces/${ws.id}/arquivos/${c.body.id}/download`).set(auth(owner.token)).expect(404);
    await api().delete(`/v1/workspaces/${ws.id}/tarefas/${task.id}/permanente`).set(auth(owner.token)).expect(204);
    await runPendingJobs(10);
    expect(deleted).toHaveLength(1);
  });
});
