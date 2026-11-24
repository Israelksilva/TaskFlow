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
export const lastBoardStorage = createStorageItem("andamo:last-board");
