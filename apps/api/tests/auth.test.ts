import { beforeEach, describe, expect, it } from "vitest";
import { api, auth, createUser, resetDatabase } from "./helpers";

beforeEach(resetDatabase);

describe("POST /auth/cadastro", () => {
  it("cria usuário, retorna token e não expõe o hash da senha", async () => {
    const res = await api()
      .post("/auth/cadastro")
      .send({ name: "Ana", email: "ANA@Test.dev", password: "senha1234" })
      .expect(201);

    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.user).toMatchObject({ name: "Ana", email: "ana@test.dev" });
    expect(res.body.user).not.toHaveProperty("passwordHash");
    expect(res.body.user).not.toHaveProperty("password_hash");
  });

  it("novo usuário começa com a lista de tarefas vazia", async () => {
    const { token } = await createUser();
    const res = await api().get("/tarefas").set(auth(token)).expect(200);
    expect(res.body.tasks).toEqual([]);
  });

  it("rejeita e-mail duplicado com 409", async () => {
    await createUser({ email: "dup@test.dev" });
    const res = await api()
      .post("/auth/cadastro")
      .send({ name: "Outro", email: "dup@test.dev", password: "senha1234" })
      .expect(409);
    expect(res.body.error.code).toBe("EMAIL_IN_USE");
  });

  it("valida os campos e retorna detalhes por campo", async () => {
    const res = await api()
      .post("/auth/cadastro")
      .send({ name: "A", email: "invalido", password: "123" })
      .expect(422);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(Object.keys(res.body.error.details)).toEqual(
      expect.arrayContaining(["name", "email", "password"]),
    );
  });
});

describe("POST /auth/login", () => {
  it("autentica com credenciais válidas", async () => {
    const { user, password } = await createUser();
    const res = await api().post("/auth/login").send({ email: user.email, password }).expect(200);
    expect(res.body.user.id).toBe(user.id);
  });

  it("retorna 401 genérico para senha errada ou e-mail inexistente", async () => {
    const { user } = await createUser();
    const wrong = await api().post("/auth/login").send({ email: user.email, password: "errada123" }).expect(401);
    const missing = await api().post("/auth/login").send({ email: "nao@existe.dev", password: "senha1234" }).expect(401);
    expect(wrong.body.error).toEqual(missing.body.error);
  });
});

describe("GET /auth/me", () => {
  it("retorna o usuário autenticado", async () => {
    const { token, user } = await createUser();
    const res = await api().get("/auth/me").set(auth(token)).expect(200);
    expect(res.body.user).toEqual(user);
  });

  it("exige token válido", async () => {
    expect((await api().get("/auth/me").expect(401)).body.error.code).toBe("MISSING_TOKEN");
    expect((await api().get("/auth/me").set(auth("abc")).expect(401)).body.error.code).toBe("INVALID_TOKEN");
  });
});

describe("infraestrutura", () => {
  it("health check", async () => {
    expect((await api().get("/health").expect(200)).body.status).toBe("ok");
  });

  it("404 para rota desconhecida e 400 para JSON malformado", async () => {
    expect((await api().get("/nada").expect(404)).body.error.code).toBe("ROUTE_NOT_FOUND");
    const res = await api()
      .post("/auth/login")
      .set("Content-Type", "application/json")
      .send("{invalido")
      .expect(400);
    expect(res.body.error.code).toBe("INVALID_JSON");
  });
});
