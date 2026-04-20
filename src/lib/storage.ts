import { Task } from "@/types/board";

const STORAGE_KEY = "taskflow:tasks:v1";

export function loadTasks(): Task[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getSeedTasks();
    const parsed = JSON.parse(raw) as Task[];
    return Array.isArray(parsed) ? parsed : getSeedTasks();
  } catch {
    return getSeedTasks();
  }
}

export function saveTasks(tasks: Task[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function getSeedTasks(): Task[] {
  const now = new Date().toISOString();
  return [
    {
      id: crypto.randomUUID(),
      title: "Bem-vindo ao TaskFlow! 👋",
      description: "Arraste este cartão para outra coluna para começar.",
      priority: "media",
      createdAt: now,
      columnId: "todo",
    },
    {
      id: crypto.randomUUID(),
      title: "Estudar React + TypeScript",
      description: "Revisar hooks, props e tipagem de componentes.",
      priority: "alta",
      createdAt: now,
      columnId: "todo",
    },
    {
      id: crypto.randomUUID(),
      title: "Construir projeto para o portfólio",
      description: "Adicionar este Kanban ao portfólio no GitHub.",
      priority: "alta",
      createdAt: now,
      columnId: "doing",
    },
    {
      id: crypto.randomUUID(),
      title: "Criar conta no LinkedIn",
      priority: "baixa",
      createdAt: now,
      columnId: "done",
    },
  ];
}
