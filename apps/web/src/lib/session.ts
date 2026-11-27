import type { AuthResponse } from "@andamo/shared";
import { createStorageItem } from "./storage";

/**
 * Sessão do navegador (ADR-003).
 * - Token de acesso (15 min): só em memória, some ao recarregar.
 * - Refresh token: no localStorage, trocado a cada renovação. Com ele a aba
 *   recupera um token de acesso novo sem pedir login.
 */
const refreshStorage = createStorageItem("andamo:refresh");
export const REFRESH_STORAGE_KEY = "andamo:refresh";

// Token do formato antigo (sem sessão no servidor): não vale mais.
createStorageItem("andamo:token").remove();

let accessToken: string | null = null;
let accessExpiresAt = 0;

/** Margem para renovar antes de o token expirar de fato. */
const EXPIRY_MARGIN_MS = 30_000;

export const session = {
  hasSession: () => Boolean(refreshStorage.get()),
  getRefreshToken: () => refreshStorage.get(),
  /** Token de acesso ainda válido, ou `null` se é preciso renovar. */
  getAccessToken() {
    return accessToken && Date.now() < accessExpiresAt - EXPIRY_MARGIN_MS ? accessToken : null;
  },
  save(auth: Pick<AuthResponse, "accessToken" | "refreshToken" | "expiresIn">) {
    accessToken = auth.accessToken;
    accessExpiresAt = Date.now() + auth.expiresIn * 1000;
    refreshStorage.set(auth.refreshToken);
  },
  /** Descarta só o token de acesso (força uma renovação na próxima chamada). */
  dropAccessToken() {
    accessToken = null;
    accessExpiresAt = 0;
  },
  clear() {
    accessToken = null;
    accessExpiresAt = 0;
    refreshStorage.remove();
  },
};
