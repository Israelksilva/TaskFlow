import { describe, expect, it } from "vitest";
import { diffColumnOrder, groupByColumn, isOverWip, moveToColumn, resolveColumnId, type BoardColumn } from "./columns";

const col = (id: string, category: BoardColumn["category"], position: number) => ({ id, category, position });
const columns = [col("todo", "todo", 0), col("review", "doing", 2), col("doing", "doing", 1), col("done", "done", 3)];
const task = (id: string, columnId: string | null, status: BoardColumn["category"], position: number) => ({ id, columnId, status, position });

describe("colunas personalizáveis", () => {
  const tasks = [task("a", "todo", "todo", 0), task("b", "todo", "todo", 1), task("c", "doing", "doing", 0)];

  it("agrupa por coluna e resolve tarefas sem coluna pela categoria", () => {
    const g = groupByColumn([...tasks, task("d", null, "done", 0)], columns);
    expect(Object.keys(g)).toEqual(["todo", "review", "doing", "done"]);
    expect(g.done.map((t) => t.id)).toEqual(["d"]);
    expect(resolveColumnId({ columnId: null, status: "doing" }, columns)).toBe("doing");
  });

  it("move para outra coluna, ajusta status e normaliza posições", () => {
    const after = moveToColumn(tasks, "a", "review", 0, columns);
    expect(after.find((t) => t.id === "a")).toMatchObject({ columnId: "review", status: "doing", position: 0 });
    expect(after.find((t) => t.id === "b")).toMatchObject({ position: 0 });
    expect(diffColumnOrder(tasks, after).map((t) => t.id).sort()).toEqual(["a", "b"]);
  });

  it("reordena dentro da coluna e limita o índice", () => {
    const after = moveToColumn(tasks, "a", "todo", 99, columns);
    expect(after.filter((t) => t.columnId === "todo").map((t) => `${t.id}${t.position}`)).toEqual(["b0", "a1"]);
  });

  it("WIP é aviso quando excede", () => {
    expect(isOverWip({ wipLimit: 2 }, 3)).toBe(true);
    expect(isOverWip({ wipLimit: 2 }, 2)).toBe(false);
    expect(isOverWip({ wipLimit: null }, 50)).toBe(false);
  });
});
