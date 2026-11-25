import { createContext, useContext } from "react";
import { CheckSquare, ListTree, MessageSquare, Repeat } from "lucide-react";
import type { BoardColumn, Label, Member, Task } from "@andamo/shared";
import { AvatarStack } from "@/components/feedback/UserAvatar";
import { LabelChip } from "./Pickers";

/** Membros e etiquetas do workspace, para os cartões mostrarem nomes/cores sem novas consultas. */
export interface BoardMeta {
  members: Map<string, Member>;
  labels: Map<string, Label>;
  /** Colunas do quadro atual (menu "Mover para"). */
  columns: BoardColumn[];
}
export const BoardMetaContext = createContext<BoardMeta | null>(null);

export function TaskCardMeta({ task }: { task: Task }) {
  const meta = useContext(BoardMetaContext);
  if (!meta) return null;
  const assignees = task.assigneeIds.map((id) => meta.members.get(id)).filter((m): m is Member => Boolean(m));
  const labels = task.labelIds.map((id) => meta.labels.get(id)).filter((l): l is Label => Boolean(l));
  const hasCounts = task.subtaskCount || task.checklistCount || task.commentCount || task.recurrence;
  if (!assignees.length && !labels.length && !hasCounts) return null;

  return (
    <div className="mt-2 space-y-2">
      {labels.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {labels.map((l) => (
            <LabelChip key={l.id} label={l} />
          ))}
        </div>
      )}
      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
        {task.subtaskCount > 0 && (
          <span className="flex items-center gap-1" title="Subtarefas concluídas">
            <ListTree className="h-3.5 w-3.5" aria-hidden /> {task.subtaskDoneCount}/{task.subtaskCount}
          </span>
        )}
        {task.checklistCount > 0 && (
          <span className="flex items-center gap-1" title="Checklist">
            <CheckSquare className="h-3.5 w-3.5" aria-hidden /> {task.checklistDoneCount}/{task.checklistCount}
          </span>
        )}
        {task.commentCount > 0 && (
          <span className="flex items-center gap-1" title="Comentários">
            <MessageSquare className="h-3.5 w-3.5" aria-hidden /> {task.commentCount}
          </span>
        )}
        {task.recurrence && <Repeat className="h-3.5 w-3.5" aria-label="Recorrente" />}
        <AvatarStack users={assignees} className="ml-auto" />
      </div>
    </div>
  );
}
