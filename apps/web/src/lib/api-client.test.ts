import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest, onSessionChange } from "./api-client";
import { session } from "./session";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const error = (status: number, code: string) => json(status, { error: { code, message: code } });
const auth = (n: number) => ({
  user: { id: "u1", name: "Ana" },
  accessToken: `access-${n}`,
  refreshToken: `refresh-token-number-${n}-xxxxxxxxxxxx`,
  expiresIn: 900,
});

let fetchMock: ReturnType<typeof vi.fn>;
const onEnd = vi.fn();
const onRefresh = vi.fn();

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  onEnd.mockReset();
  onRefresh.mockReset();
  onSessionChange({ onEnd, onRefresh });
  session.clear();
});
afterEach(() => {
  vi.unstubAllGlobals();
  onSessionChange(null);
});

const calls = () =>
  fetchMock.mock.calls.map(([url, init]) => [new URL(url).pathname, init.headers.Authorization]);

describe("apiRequest e sessão", () => {
  it("sem token de acesso em memória, renova pelo refresh token antes da chamada", async () => {
    session.save({ ...auth(0), expiresIn: 0 }); // acesso já vencido
    fetchMock
      .mockResolvedValueOnce(json(200, auth(1)))
      .mockResolvedValueOnce(json(200, { ok: true }));

    await expect(apiRequest("/tasks")).resolves.toEqual({ ok: true });
    expect(calls()).toEqual([
      ["/api/auth/sessao/renovar", undefined],
      ["/api/tasks", "Bearer access-1"],
    ]);
    expect(session.getRefreshToken()).toBe(auth(1).refreshToken);
    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it("401 TOKEN_EXPIRED: renova uma vez e repete a requisição", async () => {
    session.save(auth(0));
    fetchMock
      .mockResolvedValueOnce(error(401, "TOKEN_EXPIRED"))
      .mockResolvedValueOnce(json(200, auth(1)))
      .mockResolvedValueOnce(json(200, { ok: true }));

    await expect(apiRequest("/tasks")).resolves.toEqual({ ok: true });
    expect(calls().map(([p]) => p)).toEqual([
      "/api/tasks",
      "/api/auth/sessao/renovar",
      "/api/tasks",
    ]);
  });

  it("chamadas simultâneas compartilham uma única renovação", async () => {
    session.save({ ...auth(0), expiresIn: 0 });
    fetchMock.mockImplementation(async (url: string) =>
      url.endsWith("/renovar") ? json(200, auth(1)) : json(200, { ok: true }),
    );

    await Promise.all([apiRequest("/a"), apiRequest("/b"), apiRequest("/c")]);
    expect(calls().filter(([p]) => p === "/api/auth/sessao/renovar")).toHaveLength(1);
  });

  it("refresh recusado encerra a sessão local e avisa como expirada", async () => {
    session.save({ ...auth(0), expiresIn: 0 });
    fetchMock.mockResolvedValueOnce(error(401, "INVALID_REFRESH"));

    await expect(apiRequest("/tasks")).rejects.toMatchObject({ code: "INVALID_REFRESH" });
    expect(session.hasSession()).toBe(false);
    expect(onEnd).toHaveBeenCalledWith("expired");
  });

  it("SESSION_ROTATED (outra aba renovou): relê o armazenamento e tenta de novo", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    session.save({ ...auth(0), expiresIn: 0 });
    fetchMock
      .mockImplementationOnce(async () => {
        localStorage.setItem("andamo:refresh", auth(5).refreshToken); // a outra aba gravou o novo
        return error(401, "SESSION_ROTATED");
      })
      .mockResolvedValueOnce(json(200, auth(6)))
      .mockResolvedValueOnce(json(200, { ok: true }));

    const request = apiRequest("/tasks");
    await vi.runAllTimersAsync();
    await expect(request).resolves.toEqual({ ok: true });
    const bodies = fetchMock.mock.calls
      .slice(0, 2)
      .map(([, init]) => JSON.parse(init.body).refreshToken);
    expect(bodies).toEqual([auth(0).refreshToken, auth(5).refreshToken]);
    vi.useRealTimers();
  });

  it("SESSION_REVOKED em rota protegida encerra a sessão como revogada", async () => {
    session.save(auth(0));
    fetchMock.mockResolvedValueOnce(error(401, "SESSION_REVOKED"));

    await expect(apiRequest("/tasks")).rejects.toMatchObject({ status: 401 });
    expect(onEnd).toHaveBeenCalledWith("revoked");
    expect(session.hasSession()).toBe(false);
  });

  it("erro de rede na renovação não derruba a sessão", async () => {
    session.save({ ...auth(0), expiresIn: 0 });
    fetchMock.mockRejectedValueOnce(new TypeError("offline"));

    await expect(apiRequest("/tasks")).rejects.toMatchObject({ code: "NETWORK_ERROR" });
    expect(session.hasSession()).toBe(true);
    expect(onEnd).not.toHaveBeenCalled();
  });

  it("rotas anônimas não enviam token nem tentam renovar", async () => {
    session.save(auth(0));
    fetchMock.mockResolvedValueOnce(error(401, "INVALID_CREDENTIALS"));

    await expect(
      apiRequest("/auth/login", { method: "POST", body: {}, anonymous: true }),
    ).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS",
    });
    expect(calls()).toEqual([["/api/auth/login", undefined]]);
    expect(session.hasSession()).toBe(true);
  });
});
