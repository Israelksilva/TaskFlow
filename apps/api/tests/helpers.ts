import request from "supertest";
import type { AuthResponse, Project, Task, Workspace } from "@andamo/shared";
import { createApp } from "../src/app";
import { db } from "../src/db";
import { runPendingJobs } from "../src/jobs/worker";
import { sentMail } from "../src/lib/mailer";
import { sentPushes } from "../src/lib/push";

export const app = createApp();
export const api = () => request(app);

let counter = 0;

export async function resetDatabase() {
  await db.query("DELETE FROM workspaces");
  await db.query("DELETE FROM users");
  await db.query("DELETE FROM jobs");
  await db.query("DELETE FROM audit_log");
  await db.query("DELETE FROM contact_messages");
  sentMail.length = 0;
  sentPushes.length = 0;
}

export const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

export async function createUser(overrides: Partial<{ name: string; email: string; password: string }> = {}) {
  counter += 1;
  const payload = {
    name: "Usuário Teste",
    email: `user${counter}@test.dev`,
    password: "senha1234",
    ...overrides,
  };
  const res = await api().post("/auth/cadastro").send(payload).expect(201);
  return { ...(res.body as AuthResponse), password: payload.password };
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

// ---------------------------------------------------------------- v1
export async function createTeamWorkspace(token: string, name = "Equipe Teste") {
  const res = await api().post("/v1/workspaces").set(auth(token)).send({ name }).expect(201);
  return res.body.workspace as Workspace;
}

export async function createProject(token: string, workspaceId: string, data: Record<string, unknown> = {}) {
  const res = await api()
    .post(`/v1/workspaces/${workspaceId}/projetos`)
    .set(auth(token))
    .send({ name: "Projeto", ...data })
    .expect(201);
  return res.body.project as Project;
}

export async function createTaskV1(token: string, workspaceId: string, data: Record<string, unknown>) {
  const res = await api().post(`/v1/workspaces/${workspaceId}/tarefas`).set(auth(token)).send(data).expect(201);
  return res.body.task as Task;
}

/** Convida e faz o convidado aceitar (o token vem do e-mail capturado nos testes). */
export async function addMember(ownerToken: string, workspaceId: string, member: { token: string; user: { email: string } }, role = "member") {
  await runPendingJobs(); // esvazia e-mails pendentes anteriores
  sentMail.length = 0;
  await api().post(`/v1/workspaces/${workspaceId}/convites`).set(auth(ownerToken)).send({ email: member.user.email, role }).expect(201);
  await runPendingJobs();
  const mail = sentMail.find((m) => m.to === member.user.email && m.subject.includes("convidou"));
  const token = mail?.text.match(/convite\?token=([\w-]+)/)?.[1];
  if (!token) throw new Error("Convite não encontrado nos e-mails");
  await api().post("/v1/workspaces/convites/aceitar").set(auth(member.token)).send({ token }).expect(200);
}

/** Extrai um token de link de e-mail (verificação, redefinição). */
export function tokenFromMail(to: string, path: string): string {
  const mail = [...sentMail].reverse().find((m) => m.to === to && m.text.includes(path));
  const token = mail?.text.match(new RegExp(`${path}\\?token=([\\w-]+)`))?.[1];
  if (!token) throw new Error(`Token de ${path} não encontrado`);
  return token;
}

export { runPendingJobs, sentMail, sentPushes };
