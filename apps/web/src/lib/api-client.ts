import type { ApiErrorBody, AuthResponse } from "@andamo/shared";
import { env } from "@/config/env";
import { refreshStorage, tokenStorage } from "./storage";

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

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, QueryValue>;
  signal?: AbortSignal;
  /** Rotas públicas de autenticação não tentam renovar a sessão. */
  skipRefresh?: boolean;
}

let unauthorizedHandler: (() => void) | null = null;
let sessionUpdatedHandler: ((auth: AuthResponse) => void) | null = null;

/** Registrado pelo AuthProvider: encerra a sessão quando ela não pode ser renovada. */
export function onUnauthorized(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

/** Registrado pelo AuthProvider: recebe o usuário atualizado a cada renovação. */
export function onSessionRefreshed(handler: ((auth: AuthResponse) => void) | null) {
  sessionUpdatedHandler = handler;
}

export function buildUrl(path: string, query?: RequestOptions["query"]) {
  // Aceita URL absoluta (produção) ou relativa (proxy do Vite em desenvolvimento).
  const url = new URL(`${env.apiUrl}${path}`, window.location.origin);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
  }
  return url.toString();
}

export function saveTokens(auth: Pick<AuthResponse, "token" | "refreshToken">) {
  tokenStorage.set(auth.token);
  refreshStorage.set(auth.refreshToken);
}

let refreshing: Promise<boolean> | null = null;

/**
 * Renova a sessão com o refresh token (rotação). Várias requisições que expiram juntas
 * compartilham a mesma renovação — reusar um refresh token derrubaria a sessão.
 */
export function refreshSession(): Promise<boolean> {
  const refreshToken = refreshStorage.get();
  if (!refreshToken) return Promise.resolve(false);
  refreshing ??= fetch(buildUrl("/v1/auth/refresh"), {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ refreshToken }),
  })
    .then(async (res) => {
      if (!res.ok) return false;
      const data = (await res.json()) as AuthResponse;
      saveTokens(data);
      sessionUpdatedHandler?.(data);
      return true;
    })
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

async function send(path: string, options: RequestOptions): Promise<Response> {
  const token = tokenStorage.get();
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
    const offline = typeof navigator !== "undefined" && !navigator.onLine;
    throw new ApiError(
      0,
      "NETWORK_ERROR",
      offline ? "Você está sem conexão. Verifique a internet e tente novamente." : "Não foi possível conectar ao servidor. Tente novamente em instantes.",
    );
  }
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let response = await send(path, options);

  // Access token expirado: renova uma vez e repete a requisição.
  if (response.status === 401 && !options.skipRefresh && refreshStorage.get()) {
    if (await refreshSession()) response = await send(path, options);
  }

  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const error = (data as ApiErrorBody | null)?.error;
    if (response.status === 401 && !options.skipRefresh && tokenStorage.get()) unauthorizedHandler?.();
    throw new ApiError(
      response.status,
      error?.code ?? "UNKNOWN_ERROR",
      error?.message ?? "Erro inesperado. Tente novamente.",
      error?.details,
    );
  }

  return data as T;
}

/** Mensagem amigável (sempre terminando com pontuação) para qualquer erro capturado. */
export function getErrorMessage(error: unknown): string {
  const message = error instanceof Error && error.message ? error.message : "Erro inesperado. Tente novamente.";
  return /[.!?]$/.test(message) ? message : `${message}.`;
}
