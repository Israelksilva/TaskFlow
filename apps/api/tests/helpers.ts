import request from "supertest";
import type { AuthResponse, Task } from "@andamo/shared";
import { createApp } from "../src/app";
import { db } from "../src/db";

export const app = createApp();
export const api = () => request(app);

let counter = 0;

export async function resetDatabase() {
  await db.query("DELETE FROM login_throttle");
  await db.query("DELETE FROM auth_tokens");
  await db.query("DELETE FROM contact_messages");
  await db.query("DELETE FROM tasks");
  await db.query("DELETE FROM users");
}

export const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

export async function createUser(
  overrides: Partial<{ name: string; email: string; password: string }> = {},
) {
  counter += 1;
  const payload = {
    name: "Usuário Teste",
    email: `user${counter}@test.dev`,
    password: "senha1234",
    ...overrides,
  };
  const res = await api().post("/auth/cadastro").send(payload).expect(201);
  const body = res.body as AuthResponse;
  return { ...body, token: body.accessToken, password: payload.password };
}

export async function createTask(token: string, data: Record<string, unknown>) {
  const res = await api().post("/tarefas").set(auth(token)).send(data).expect(201);
  return res.body.task as Task;
}

export async function listTasks(token: string, query = "") {
  const res = await api().get(`/tarefas${query}`).set(auth(token)).expect(200);
  return res.body.tasks as Task[];
}

/** Snapshot legível "titulo:status:posicao" na ordem do quadro. */
export const layout = (tasks: Task[]) => tasks.map((t) => `${t.title}:${t.status}:${t.position}`);

import { MemoryMailer, mailer } from "../src/modules/mail/mailer";

/** E-mails "enviados" durante o teste. */
export const outbox = mailer as MemoryMailer;

/** Extrai o token do link de um e-mail (`...#/rota?token=...`). */
export function tokenFromMail(template: string): string {
  const mail = [...outbox.sent].reverse().find((m) => m.template === template);
  if (!mail) throw new Error(`Nenhum e-mail "${template}" enviado`);
  const match = mail.text.match(/[?&]token=([\w-]+)/);
  if (!match) throw new Error("Link sem token");
  return match[1];
}
