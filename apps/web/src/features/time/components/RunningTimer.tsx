import { Link } from "react-router-dom";
import { Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatClock } from "../api";
import { useElapsed, useRunningTimer, useTimerActions } from "../hooks";

/** Indicador no header: cronômetro em andamento (de qualquer workspace) com botão de parar. */
export function RunningTimer() {
  const running = useRunningTimer().data;
  const elapsed = useElapsed(running);
  const { stop } = useTimerActions(running?.workspaceId);
  if (!running) return null;
  return (
    <div className="flex items-center gap-1 rounded-full border border-coral/40 bg-coral/10 py-0.5 pl-3 pr-0.5 text-xs font-medium text-coral" role="status">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-coral" aria-hidden />
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            to={`/app/w/${running.workspaceId}/projetos/${running.projectId}?tarefa=${running.taskId}`}
            className="flex items-center gap-1.5 hover:underline"
            aria-label={`Cronômetro em ${running.taskTitle}: ${formatClock(elapsed)}`}
          >
            <span className="hidden max-w-[10rem] truncate lg:inline">{running.taskTitle}</span>
            <span className="font-mono tabular-nums">{formatClock(elapsed)}</span>
          </Link>
        </TooltipTrigger>
        <TooltipContent>{running.taskTitle}</TooltipContent>
      </Tooltip>
      <Button size="icon" variant="ghost" className="h-6 w-6 rounded-full text-coral hover:bg-coral/20 hover:text-coral" onClick={() => stop.mutate()} disabled={stop.isPending} aria-label="Parar cronômetro">
        <Square className="h-3 w-3 fill-current" />
      </Button>
    </div>
  );
}
