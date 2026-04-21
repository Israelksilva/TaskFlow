import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { toast } from "sonner";
import { ColumnId, COLUMNS, Task } from "@/types/board";
import { loadTasks, saveTasks } from "@/lib/storage";
import { BoardColumn } from "./BoardColumn";
import { TaskCard } from "./TaskCard";
import { TaskDialog } from "./TaskDialog";
import { Header } from "./Header";
import { Footer } from "./Footer";

export const KanbanBoard = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [defaultColumn, setDefaultColumn] = useState<ColumnId>("todo");

  useEffect(() => {
    setTasks(loadTasks());
  }, []);

  useEffect(() => {
    if (tasks.length >= 0) saveTasks(tasks);
  }, [tasks]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } })
  );

  const tasksByColumn = useMemo(() => {
    const map: Record<ColumnId, Task[]> = { todo: [], doing: [], done: [] };
    tasks.forEach((t) => map[t.columnId].push(t));
    return map;
  }, [tasks]);

  const completedCount = tasksByColumn.done.length;

  const openNewTask = (columnId: ColumnId = "todo") => {
    setEditingTask(null);
    setDefaultColumn(columnId);
    setDialogOpen(true);
  };

  const openEditTask = (task: Task) => {
    setEditingTask(task);
    setDialogOpen(true);
  };

  const handleSubmit = (data: Omit<Task, "id" | "createdAt">) => {
    if (editingTask) {
      setTasks((prev) =>
        prev.map((t) => (t.id === editingTask.id ? { ...t, ...data } : t))
      );
      toast.success("Tarefa atualizada!");
    } else {
      const newTask: Task = {
        ...data,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      };
      setTasks((prev) => [...prev, newTask]);
      toast.success("Tarefa criada!");
    }
  };

  const handleDelete = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    toast.success("Tarefa excluída");
  };

  const handleDragStart = (event: DragStartEvent) => {
    const task = event.active.data.current?.task as Task | undefined;
    if (task) setActiveTask(task);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    const isOverColumn = over.data.current?.type === "column";
    const isOverTask = over.data.current?.type === "task";

    setTasks((prev) => {
      const activeIdx = prev.findIndex((t) => t.id === activeId);
      if (activeIdx === -1) return prev;
      const activeTaskItem = prev[activeIdx];

      if (isOverColumn) {
        const newColId = overId as ColumnId;
        if (activeTaskItem.columnId === newColId) return prev;
        const updated = [...prev];
        updated[activeIdx] = { ...activeTaskItem, columnId: newColId };
        return updated;
      }

      if (isOverTask) {
        const overIdx = prev.findIndex((t) => t.id === overId);
        if (overIdx === -1) return prev;
        const overTaskItem = prev[overIdx];
        if (activeTaskItem.columnId !== overTaskItem.columnId) {
          const updated = [...prev];
          updated[activeIdx] = {
            ...activeTaskItem,
            columnId: overTaskItem.columnId,
          };
          return arrayMove(updated, activeIdx, overIdx);
        }
        return arrayMove(prev, activeIdx, overIdx);
      }

      return prev;
    });
  };

  const handleDragEnd = (_event: DragEndEvent) => {
    setActiveTask(null);
  };

  return (
    <div className="flex min-h-screen flex-col bg-gradient-surface">
      <Header
        onNewTask={() => openNewTask("todo")}
        totalTasks={tasks.length}
        completedTasks={completedCount}
      />

      <main className="container mx-auto flex-1 px-4 py-6 md:py-8">
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="scrollbar-thin flex gap-5 overflow-x-auto pb-4 md:justify-center">
            {COLUMNS.map((col) => (
              <BoardColumn
                key={col.id}
                column={col}
                tasks={tasksByColumn[col.id]}
                onAddTask={() => openNewTask(col.id)}
                onEditTask={openEditTask}
                onDeleteTask={handleDelete}
              />
            ))}
          </div>

          <DragOverlay>
            {activeTask ? (
              <TaskCard
                task={activeTask}
                onEdit={() => {}}
                onDelete={() => {}}
                isOverlay
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      </main>

      <Footer />

      <TaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
        initial={editingTask}
        defaultColumn={defaultColumn}
      />
    </div>
  );
};
