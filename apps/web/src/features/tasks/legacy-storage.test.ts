import { beforeEach, describe, expect, it } from "vitest";
import {
  LEGACY_KEY,
  convertLegacyTasks,
  dismissLegacyImport,
  getPendingLegacyTasks,
  markLegacyImported,
} from "./legacy-storage";

describe("convertLegacyTasks", () => {
  it("converte o formato antigo e descarta itens inválidos", () => {
    const result = convertLegacyTasks([
      { id: "1", title: " Estudar ", priority: "alta", columnId: "doing", dueDate: "2026-01-10", createdAt: "x" },
      { title: "Sem extras" },
      { title: "   " },
      { title: "Data ruim", dueDate: "10/01/2026", priority: "critica", columnId: "arquivo" },
      null,
    ]);
    expect(result).toEqual([
      { title: "Estudar", description: null, priority: "alta", status: "doing", dueDate: "2026-01-10" },
      { title: "Sem extras", description: null, priority: "media", status: "todo", dueDate: null },
      { title: "Data ruim", description: null, priority: "media", status: "todo", dueDate: null },
    ]);
  });

  it("retorna lista vazia para dados que não são array", () => {
    expect(convertLegacyTasks({ foo: 1 })).toEqual([]);
  });
});

describe("getPendingLegacyTasks", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("lê as tarefas antigas e preserva os dados originais após importar", () => {
    localStorage.setItem(LEGACY_KEY, JSON.stringify([{ title: "Antiga", columnId: "done" }]));
    expect(getPendingLegacyTasks()).toHaveLength(1);

    markLegacyImported();
    expect(getPendingLegacyTasks()).toEqual([]);
    expect(localStorage.getItem(LEGACY_KEY)).not.toBeNull();
  });

  it("não oferece de novo na mesma sessão depois de “Agora não”", () => {
    localStorage.setItem(LEGACY_KEY, JSON.stringify([{ title: "Antiga" }]));
    dismissLegacyImport();
    expect(getPendingLegacyTasks()).toEqual([]);
  });

  it("tolera JSON corrompido", () => {
    localStorage.setItem(LEGACY_KEY, "{quebrado");
    expect(getPendingLegacyTasks()).toEqual([]);
  });
});
