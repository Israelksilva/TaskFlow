import type { ApiErrorBody, AuthResponse } from "@andamo/shared";
import { env } from "@/config/env";
import { session } from "./session";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type QueryValue = string | number | boolean | null | undefined;

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, QueryValue>;
  signal?: AbortSignal;
  /** Rotas públicas de autenticação: não envia token nem tenta renovar a sessão. */
  anonymous?: boolean;
}

export type SessionEndReason = "expired" | "revoked";
type SessionListener = {
  onEnd: (reason: SessionEndReason) => void;
  onRefresh: (auth: AuthResponse) => void;
};
let listener: SessionListener | null = null;

/** Registrado pelo AuthProvider: fim da sessão (renovação recusada) e renovações bem-sucedidas. */
export function onSessionChange(handler: SessionListener | null) {
  listener = handler;
}

function buildUrl(path: string, query?: RequestOptions["query"]) {
  // Aceita URL absoluta (produção) ou relativa (proxy do Vite em desenvolvimento).
  const url = new URL(`${env.apiUrl}${path}`, window.location.origin);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== "")
      url.searchParams.set(key, String(value));
  }
  return url.toString();
}

async function send(path: string, options: RequestOptions, token: string | null) {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    return await fetch(buildUrl(path, options.query), {
      method: options.method ?? "GET",
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(
      0,
      "NETWORK_ERROR",
      "Não foi possível conectar ao servidor. Verifique sua conexão.",
    );
  }
}

async function toApiError(response: Response) {
  const data = (await response.json().catch(() => null)) as ApiErrorBody | null;
  const error = data?.error;
  return new ApiError(
    response.status,
    error?.code ?? "UNKNOWN_ERROR",
    error?.message ?? "Erro inesperado. Tente novamente.",
    error?.details,
  );
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Troca o refresh token guardado por um novo par. Lança ApiError em caso de falha. */
async function doRefresh(): Promise<AuthResponse> {
  for (let attempt = 0; ; attempt++) {
    // Relido a cada tentativa: outra aba pode ter acabado de renovar.
    const refreshToken = session.getRefreshToken();
    if (!refreshToken) throw new ApiError(401, "NO_SESSION", "Sessão encerrada.");
    const response = await send(
      "/auth/sessao/renovar",
      { method: "POST", body: { refreshToken } },
      null,
    );
    if (response.ok) {
      const auth = (await response.json()) as AuthResponse;
      session.save(auth);
      listener?.onRefresh(auth);
      return auth;
    }
    const error = await toApiError(response);
    if (error.code === "SESSION_ROTATED" && attempt < 2) {
      await wait(400);
      continue;
    }
    throw error;
  }
}

let inFlight: Promise<AuthResponse> | null = null;

async function withLock(locks: LockManager): Promise<AuthResponse> {
  let result: AuthResponse | undefined;
  await locks.request("andamo:refresh", async () => {
    result = await doRefresh();
  });
  return result as AuthResponse;
}

/**
 * Renovação única por vez: uma promessa por aba e, onde existe, uma trava entre
 * abas (Web Locks) — assim duas abas nunca apresentam o mesmo refresh token.
 */
export function refreshSession(): Promise<AuthResponse> {
  if (!inFlight) {
    const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
    const pending = locks ? withLock(locks) : doRefresh();
    inFlight = pending.finally(() => {
      inFlight = null;
    });
    return inFlight;
  }
  return inFlight;
}

/** Garante um token de acesso válido, renovando se preciso. `null` = sem sessão. */
async function ensureAccessToken(): Promise<string | null> {
  const current = session.getAccessToken();
  if (current || !session.hasSession()) return current;
  try {
    return (await refreshSession()).accessToken;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) endSession("expired");
    throw error;
  }
}

function endSession(reason: SessionEndReason) {
  if (!session.hasSession()) return;
  session.clear();
  listener?.onEnd(reason);
}

const RETRYABLE_AUTH = new Set(["TOKEN_EXPIRED", "INVALID_TOKEN", "MISSING_TOKEN"]);

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let token = options.anonymous ? null : await ensureAccessToken();
  let response = await send(path, options, token);

  if (response.status === 401 && token) {
    const error = await toApiError(response.clone());
    if (RETRYABLE_AUTH.has(error.code)) {
      // Token recusado (ex.: relógio adiantado): renova uma vez e repete.
      session.dropAccessToken();
      token = await ensureAccessToken();
      response = await send(path, options, token);
    }
  }

  if (response.status === 204) return undefined as T;
  if (!response.ok) {
    const error = await toApiError(response);
    if (response.status === 401 && token) {
      endSession(error.code === "SESSION_REVOKED" ? "revoked" : "expired");
    }
    throw error;
  }
  return (await response.json().catch(() => null)) as T;
}

/** Mensagem amigável (sempre terminando com pontuação) para qualquer erro capturado. */
export function getErrorMessage(error: unknown): string {
  const message =
    error instanceof Error && error.message ? error.message : "Erro inesperado. Tente novamente.";
  return /[.!?]$/.test(message) ? message : `${message}.`;
}
