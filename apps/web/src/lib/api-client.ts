import type { ApiErrorBody } from "@andamo/shared";
import { env } from "@/config/env";
import { tokenStorage } from "./storage";

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
}

let unauthorizedHandler: (() => void) | null = null;

/** Registrado pelo AuthProvider: encerra a sessão quando a API responde 401. */
export function onUnauthorized(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

function buildUrl(path: string, query?: RequestOptions["query"]) {
  // Aceita URL absoluta (produção) ou relativa (proxy do Vite em desenvolvimento).
  const url = new URL(`${env.apiUrl}${path}`, window.location.origin);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
  }
  return url.toString();
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = tokenStorage.get();
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(buildUrl(path, options.query), {
      method: options.method ?? "GET",
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(0, "NETWORK_ERROR", "Não foi possível conectar ao servidor. Verifique se a API está rodando.");
  }

  if (response.status === 204) return undefined as T;

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const error = (data as ApiErrorBody | null)?.error;
    if (response.status === 401 && token) unauthorizedHandler?.();
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
