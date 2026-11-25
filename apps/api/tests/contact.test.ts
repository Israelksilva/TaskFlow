import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../src/db";
import { api, resetDatabase } from "./helpers";

beforeEach(resetDatabase);

const valid = {
  name: "  Maria  ",
  email: " MARIA@Exemplo.com ",
  topic: "duvida",
  message: "Gostaria de saber quando chegam os projetos.",
  consent: true,
  website: "",
  elapsedMs: 8000,
};

const count = async () =>
  (await db.query<{ n: number }>("SELECT count(*)::int AS n FROM contact_messages")).rows[0].n;

describe("POST /v1/contato", () => {
  it("grava a mensagem normalizada", async () => {
    await api().post("/v1/contato").send(valid).expect(201, { ok: true });
    const { rows } = await db.query("SELECT name, email, topic, status FROM contact_messages");
    expect(rows).toEqual([
      { name: "Maria", email: "maria@exemplo.com", topic: "duvida", status: "novo" },
    ]);
  });

  it("valida campos e exige consentimento", async () => {
    const res = await api()
      .post("/v1/contato")
      .send({ ...valid, email: "x", message: "curta", consent: false, topic: "nada" })
      .expect(422);
    expect(Object.keys(res.body.error.details)).toEqual(
      expect.arrayContaining(["email", "message", "consent", "topic"]),
    );
    expect(await count()).toBe(0);
  });

  it("descarta em silêncio envio com campo-isca ou rápido demais", async () => {
    await api()
      .post("/v1/contato")
      .send({ ...valid, website: "http://spam.example" })
      .expect(201);
    await api()
      .post("/v1/contato")
      .send({ ...valid, elapsedMs: 500 })
      .expect(201);
    expect(await count()).toBe(0);
  });

  it("não aceita campos fora do formulário", async () => {
    await api()
      .post("/v1/contato")
      .send({ ...valid, status: "respondido" })
      .expect(201);
    const { rows } = await db.query<{ status: string }>("SELECT status FROM contact_messages");
    expect(rows[0].status).toBe("novo");
  });
});
