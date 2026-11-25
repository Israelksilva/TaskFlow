import { beforeEach, describe, expect, it } from "vitest";
import { api, auth, createUser, resetDatabase } from "./helpers";

beforeEach(resetDatabase);

describe("health checks", () => {
  it("live, ready e o legado /health respondem 200", async () => {
    expect((await api().get("/health/live").expect(200)).body.status).toBe("ok");
    const ready = await api().get("/health/ready").expect(200);
    expect(ready.body.checks).toEqual({ database: "ok" });
    expect((await api().get("/health").expect(200)).body.status).toBe("ok");
  });
});

describe("request id", () => {
  it("gera X-Request-Id e reaproveita um id válido recebido", async () => {
    const generated = await api().get("/health/live");
    expect(generated.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);

    const echoed = await api().get("/health/live").set("X-Request-Id", "trace-abc-123");
    expect(echoed.headers["x-request-id"]).toBe("trace-abc-123");

    const rejected = await api().get("/health/live").set("X-Request-Id", "inválido com espaço");
    expect(rejected.headers["x-request-id"]).not.toBe("inválido com espaço");
  });
});

describe("/v1", () => {
  it("expõe as mesmas rotas com e sem prefixo", async () => {
    const { token } = await createUser();
    const created = await api()
      .post("/v1/tarefas")
      .set(auth(token))
      .send({ title: "Via v1" })
      .expect(201);
    expect(created.headers.location).toBe(`/v1/tarefas/${created.body.task.id}`);

    const legacy = await api().get("/tarefas").set(auth(token)).expect(200);
    const v1 = await api().get("/v1/tarefas").set(auth(token)).expect(200);
    expect(v1.body).toEqual(legacy.body);
    await api().get("/v1/auth/me").set(auth(token)).expect(200);
  });

  it("publica a especificação OpenAPI e a página de docs", async () => {
    const spec = await api().get("/v1/openapi.json").expect(200);
    expect(spec.body.openapi).toBe("3.1.0");
    expect(Object.keys(spec.body.paths)).toEqual(
      expect.arrayContaining(["/auth/login", "/tarefas", "/tarefas/{id}"]),
    );
    const titleSchema =
      spec.body.paths["/tarefas"].post.requestBody.content["application/json"].schema;
    expect(titleSchema.required).toContain("title");

    const docs = await api().get("/v1/docs").expect(200);
    expect(docs.headers["content-type"]).toMatch(/text\/html/);
  });

  it("rota inexistente em /v1 devolve 404 no formato padrão", async () => {
    const res = await api().get("/v1/nao-existe").expect(404);
    expect(res.body.error.code).toBe("ROUTE_NOT_FOUND");
  });
});
