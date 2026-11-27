import { expect, type APIRequestContext, type Page } from "@playwright/test";

export const PASSWORD = "SenhaE2e12345";

let seq = 0;
/** E-mail único por teste (o banco em memória é compartilhado durante a execução). */
export const uniqueEmail = (prefix = "e2e") => `${prefix}.${Date.now().toString(36)}${(seq++).toString(36)}@andamo.test`;

export interface Session {
  token: string;
  refreshToken: string;
  user: { id: string; name: string; email: string };
}

/** Cria a conta direto na API (via proxy do Vite) — mais rápido que pela tela. */
export async function apiRegister(request: APIRequestContext, name = "Pessoa Teste"): Promise<Session> {
  const res = await request.post("/api/v1/auth/cadastro", { data: { name, email: uniqueEmail(), password: PASSWORD } });
  expect(res.ok(), await res.text()).toBeTruthy();
  return (await res.json()) as Session;
}

export async function api<T = unknown>(request: APIRequestContext, s: Session, method: string, path: string, data?: unknown): Promise<T> {
  const res = await request.fetch(`/api${path}`, { method, data, headers: { authorization: `Bearer ${s.token}` } });
  expect(res.ok(), `${method} ${path}: ${await res.text()}`).toBeTruthy();
  return (res.status() === 204 ? null : await res.json()) as T;
}

/** Abre o app já autenticado (tokens no localStorage, como o front faz após o login) e pula o onboarding. */
export async function signIn(page: Page, s: Session, request: APIRequestContext) {
  await api(request, s, "POST", "/v1/auth/onboarding", {}).catch(() => undefined);
  await page.addInitScript(([t, r]) => {
    localStorage.setItem("andamo:token", t);
    localStorage.setItem("andamo:refresh", r);
  }, [s.token, s.refreshToken] as const);
}

/** Workspace pessoal do usuário (criado no cadastro). */
export async function personalWorkspace(request: APIRequestContext, s: Session) {
  const { workspaces } = await api<{ workspaces: Array<{ id: string; isPersonal: boolean }> }>(request, s, "GET", "/v1/workspaces");
  return workspaces.find((w) => w.isPersonal)!.id;
}
