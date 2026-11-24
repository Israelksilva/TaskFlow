import { describe, expect, it } from "vitest";
import {
  computeBoardStats,
  diffOrder,
  filterTasks,
  groupByStatus,
  hasActiveFilters,
  isTaskOverdue,
  moveTask,
  removeTask,
  type TaskLike,
} from "./kanban";
import { addDays } from "./dates";

const make = (id: string, status: TaskLike["status"], position: number, extra: Partial<TaskLike> = {}): TaskLike => ({
  id,
  status,
  position,
  title: `Tarefa ${id}`,
  description: null,
  priority: "media",
  dueDate: null,
  ...extra,
});

const ids = (tasks: TaskLike[]) => tasks.map((t) => `${t.id}:${t.status}:${t.position}`);

describe("groupByStatus", () => {
  it("agrupa por coluna e ordena por posição", () => {
    const groups = groupByStatus([make("b", "todo", 1), make("c", "done", 0), make("a", "todo", 0)]);
    expect(groups.todo.map((t) => t.id)).toEqual(["a", "b"]);
    expect(groups.doing).toEqual([]);
    expect(groups.done.map((t) => t.id)).toEqual(["c"]);
  });
});

describe("moveTask", () => {
  const tasks = [make("a", "todo", 0), make("b", "todo", 1), make("c", "todo", 2), make("d", "doing", 0)];

  it("reordena dentro da mesma coluna", () => {
    expect(ids(moveTask(tasks, "a", "todo", 2))).toEqual(["b:todo:0", "c:todo:1", "a:todo:2", "d:doing:0"]);
  });

  it("move entre colunas e compacta as posições da origem", () => {
    expect(ids(moveTask(tasks, "b", "doing", 0))).toEqual(["a:todo:0", "c:todo:1", "b:doing:0", "d:doing:1"]);
  });

  it("limita o índice ao tamanho da coluna de destino", () => {
    expect(ids(moveTask(tasks, "a", "done", 99))).toEqual(["b:todo:0", "c:todo:1", "d:doing:0", "a:done:0"]);
  });

  it("não altera a lista original", () => {
    const copy = structuredClone(tasks);
    moveTask(tasks, "a", "done", 0);
    expect(tasks).toEqual(copy);
  });

  it("lança erro para tarefa inexistente", () => {
    expect(() => moveTask(tasks, "x", "todo", 0)).toThrow();
  });
});

describe("removeTask / diffOrder", () => {
  it("compacta posições após remover e detecta mudanças", () => {
    const tasks = [make("a", "todo", 0), make("b", "todo", 1), make("c", "todo", 2)];
    const after = removeTask(tasks, "a");
    expect(ids(after)).toEqual(["b:todo:0", "c:todo:1"]);
    expect(diffOrder(tasks, after).map((t) => t.id)).toEqual(["b", "c"]);
  });
});

describe("prazos e filtros", () => {
  const today = "2026-05-10";

  it("considera atrasada apenas tarefa não concluída com prazo passado", () => {
    expect(isTaskOverdue({ dueDate: addDays(today, -1), status: "todo" }, today)).toBe(true);
    expect(isTaskOverdue({ dueDate: today, status: "todo" }, today)).toBe(false);
    expect(isTaskOverdue({ dueDate: addDays(today, -1), status: "done" }, today)).toBe(false);
    expect(isTaskOverdue({ dueDate: null, status: "todo" }, today)).toBe(false);
  });

  it("filtra por busca (sem acento), prioridade e atraso", () => {
    const tasks = [
      make("a", "todo", 0, { title: "Revisar ORÇAMENTO", priority: "alta" }),
      make("b", "todo", 1, { description: "orcamento anual", dueDate: "2026-05-01" }),
      make("c", "doing", 0, { title: "Outra coisa" }),
    ];
    expect(filterTasks(tasks, { search: "orçamento" }, today).map((t) => t.id)).toEqual(["a", "b"]);
    expect(filterTasks(tasks, { priority: "alta" }, today).map((t) => t.id)).toEqual(["a"]);
    expect(filterTasks(tasks, { onlyOverdue: true }, today).map((t) => t.id)).toEqual(["b"]);
    expect(hasActiveFilters({ search: "  ", priority: "all" })).toBe(false);
    expect(hasActiveFilters({ priority: "baixa" })).toBe(true);
  });
});

describe("computeBoardStats", () => {
  it("calcula totais, atraso e taxa de conclusão", () => {
    const today = "2026-05-10";
    const stats = computeBoardStats(
      [
        make("a", "todo", 0, { priority: "alta", dueDate: "2026-05-01" }),
        make("b", "doing", 0, { dueDate: today }),
        make("c", "done", 0, { priority: "baixa" }),
        make("d", "done", 1, { priority: "baixa" }),
      ],
      today,
    );
    expect(stats).toMatchObject({
      total: 4,
      completed: 2,
      overdue: 1,
      dueToday: 1,
      completionRate: 50,
      byStatus: { todo: 1, doing: 1, done: 2 },
      byPriority: { alta: 1, media: 1, baixa: 2 },
    });
  });

  it("retorna 0% para quadro vazio", () => {
    expect(computeBoardStats([]).completionRate).toBe(0);
  });
});
