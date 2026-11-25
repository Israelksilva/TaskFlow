/**
 * Acesso seguro ao localStorage (pode falhar em modo privado ou com cookies bloqueados).
 */
function createStorageItem(key: string) {
  return {
    get(): string | null {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    set(value: string) {
      try {
        localStorage.setItem(key, value);
      } catch {
        /* armazenamento indisponível */
      }
    },
    remove() {
      try {
        localStorage.removeItem(key);
      } catch {
        /* armazenamento indisponível */
      }
    },
  };
}

export const tokenStorage = createStorageItem("andamo:token");
export const refreshStorage = createStorageItem("andamo:refresh");
export const lastBoardStorage = createStorageItem("andamo:last-board");
export const workspaceStorage = createStorageItem("andamo:workspace");
export const sidebarStorage = createStorageItem("andamo:sidebar");
export const searchHistoryStorage = createStorageItem("andamo:search-history");

/** Preferências de interface que podem sobreviver ao logout (não são dados pessoais). */
const KEEP_ON_LOGOUT = new Set(["theme", "andamo:sidebar"]);

/**
 * Logout: apaga tokens e dados locais do usuário (histórico de busca, workspace atual)
 * e o cache do service worker com respostas da API.
 */
export async function clearLocalUserData() {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("andamo:") && !KEEP_ON_LOGOUT.has(key) && !key.startsWith("andamo:legacy")) localStorage.removeItem(key);
    }
    sessionStorage.clear();
  } catch {
    /* armazenamento indisponível */
  }
  try {
    if ("caches" in window) {
      for (const name of await caches.keys()) if (name.startsWith("andamo-api")) await caches.delete(name);
    }
  } catch {
    /* Cache Storage indisponível */
  }
}
