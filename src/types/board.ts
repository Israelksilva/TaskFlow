export type Priority = "baixa" | "media" | "alta";
export type ColumnId = "todo" | "doing" | "done";

export interface Task {
  id: string;
  title: string;
  description?: string;
  priority: Priority;
  dueDate?: string;
  createdAt: string;
  columnId: ColumnId;
}

export interface Column {
  id: ColumnId;
  title: string;
  emoji: string;
}

export const COLUMNS: Column[] = [
  { id: "todo", title: "A Fazer", emoji: "📋" },
  { id: "doing", title: "Em Progresso", emoji: "⚡" },
  { id: "done", title: "Concluído", emoji: "✅" },
];

export const PRIORITY_LABELS: Record<Priority, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
};
