import { LayoutDashboard, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  onNewTask: () => void;
  totalTasks: number;
  completedTasks: number;
}

export const Header = ({ onNewTask, totalTasks, completedTasks }: HeaderProps) => {
  const progress = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

  return (
    <header className="relative overflow-hidden border-b border-border bg-gradient-hero">
      <div className="absolute inset-0 opacity-20" aria-hidden>
        <div className="absolute -top-24 -left-16 h-72 w-72 rounded-full bg-primary-glow blur-3xl" />
        <div className="absolute -bottom-24 right-0 h-80 w-80 rounded-full bg-accent blur-3xl" />
      </div>

      <div className="container relative mx-auto flex flex-col gap-6 px-4 py-8 md:flex-row md:items-center md:justify-between md:py-10">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-md ring-1 ring-white/30">
            <LayoutDashboard className="h-7 w-7 text-primary-foreground" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-extrabold tracking-tight text-primary-foreground md:text-4xl">
                TaskFlow
              </h1>
              <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium text-primary-foreground backdrop-blur-md ring-1 ring-white/20">
                <Sparkles className="h-3 w-3" />
                Kanban
              </span>
            </div>
            <p className="mt-1 text-sm text-primary-foreground/85 md:text-base">
              Organize suas tarefas com estilo — arraste, solte e conclua.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden rounded-xl bg-white/10 px-4 py-2.5 text-primary-foreground backdrop-blur-md ring-1 ring-white/20 sm:block">
            <div className="text-[10px] uppercase tracking-wider text-primary-foreground/70">
              Progresso
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold">{progress}%</span>
              <span className="text-xs text-primary-foreground/70">
                {completedTasks}/{totalTasks}
              </span>
            </div>
            <div className="mt-1 h-1 w-28 overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full rounded-full bg-primary-foreground transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <Button
            onClick={onNewTask}
            size="lg"
            className="bg-white text-primary shadow-elevated hover:bg-white/95 hover:scale-[1.02] transition-smooth font-semibold"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Nova Tarefa
          </Button>
        </div>
      </div>
    </header>
  );
};
