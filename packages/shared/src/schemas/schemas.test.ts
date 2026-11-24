import { describe, expect, it } from "vitest";
import { registerSchema } from "./auth";
import { createTaskSchema, importTasksSchema, updateTaskSchema } from "./task";

describe("registerSchema", () => {
  it("normaliza e-mail e exige senha forte", () => {
    const ok = registerSchema.safeParse({ name: " Ana ", email: " ANA@Mail.com ", password: "senha123" });
    expect(ok.success && ok.data).toEqual({ name: "Ana", email: "ana@mail.com", password: "senha123" });
    expect(registerSchema.safeParse({ name: "Ana", email: "ana@mail.com", password: "semnumero" }).success).toBe(false);
  });
});

describe("createTaskSchema", () => {
  it("aplica valores padrão e normaliza vazios para null", () => {
    const result = createTaskSchema.parse({ title: "  Nova  ", description: "", dueDate: "" });
    expect(result).toEqual({ title: "Nova", description: null, priority: "media", status: "todo", dueDate: null });
  });

  it("rejeita datas inexistentes", () => {
    expect(createTaskSchema.safeParse({ title: "x", dueDate: "2026-02-30" }).success).toBe(false);
    expect(createTaskSchema.safeParse({ title: "x", dueDate: "2028-02-29" }).success).toBe(true);
  });
});

describe("updateTaskSchema", () => {
  it("exige ao menos um campo e diferencia 'limpar' de 'não informar'", () => {
    expect(updateTaskSchema.safeParse({}).success).toBe(false);
    expect(updateTaskSchema.parse({ dueDate: "" })).toEqual({ dueDate: null });
    expect(updateTaskSchema.parse({ priority: "alta" })).toEqual({ priority: "alta" });
  });
});

describe("updateTaskSchema (posição)", () => {
  it("aceita apenas posições inteiras não negativas e rejeita campos desconhecidos", () => {
    expect(updateTaskSchema.safeParse({ status: "doing", position: 0 }).success).toBe(true);
    expect(updateTaskSchema.safeParse({ position: -1 }).success).toBe(false);
    expect(updateTaskSchema.safeParse({ position: 1.5 }).success).toBe(false);
    expect(updateTaskSchema.safeParse({ status: "x" }).success).toBe(false);
    expect(updateTaskSchema.safeParse({ id: "outro" }).success).toBe(false);
  });
});

describe("importTasksSchema", () => {
  it("valida cada tarefa do lote", () => {
    expect(importTasksSchema.safeParse({ tasks: [] }).success).toBe(false);
    expect(importTasksSchema.safeParse({ tasks: [{ title: "" }] }).success).toBe(false);
    expect(importTasksSchema.parse({ tasks: [{ title: "Antiga", status: "done" }] }).tasks[0]).toMatchObject({
      title: "Antiga",
      status: "done",
      priority: "media",
    });
  });
});
