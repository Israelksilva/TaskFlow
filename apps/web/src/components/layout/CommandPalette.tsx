import { useQueryClient } from "@tanstack/react-query";
import { CornerDownLeft, FileText, LogOut, Plus, Search } from "lucide-react";
import { useTheme } from "next-themes";
import { useNavigate } from "react-router-dom";
import { STATUS_LABELS, type Task } from "@andamo/shared";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/features/auth/use-auth";
import { TASKS_KEY } from "@/features/tasks/hooks";
import { THEMES } from "./AccountMenu";
import { NAV_SECTIONS } from "./nav";

/**
 * Paleta de comandos (Ctrl/Cmd + K): navegação, ações existentes, tarefas do
 * quadro (lidas do cache, sem requisição extra), tema e sair.
 */
export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { setTheme } = useTheme();
  const { logout } = useAuth();
  const tasks = open ? (qc.getQueryData<Task[]>(TASKS_KEY) ?? []) : [];

  const run = (fn: () => void) => {
    onOpenChange(false);
    // Deixa o diálogo fechar (e devolver o foco) antes de abrir outro.
    setTimeout(fn, 0);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-[12vh] max-w-xl translate-y-0 gap-0 overflow-hidden p-0 data-[state=open]:slide-in-from-top-2 [&>button:last-child]:hidden">
        <DialogTitle className="sr-only">Paleta de comandos</DialogTitle>
        <DialogDescription className="sr-only">
          Digite para filtrar. Use as setas para escolher e Enter para executar.
        </DialogDescription>
        <Command loop>
          <CommandInput placeholder="Buscar tarefas, páginas e ações…" aria-label="Buscar comandos" />
          <CommandList>
            <CommandEmpty>Nada encontrado.</CommandEmpty>

            <CommandGroup heading="Ações">
              <CommandItem onSelect={() => run(() => navigate("/?nova=1"))}>
                <Plus aria-hidden /> Nova tarefa
                <CommandShortcut>N</CommandShortcut>
              </CommandItem>
              <CommandItem onSelect={() => run(() => navigate("/?buscar=1"))}>
                <Search aria-hidden /> Buscar no quadro
                <CommandShortcut>/</CommandShortcut>
              </CommandItem>
            </CommandGroup>

            <CommandGroup heading="Ir para">
              {NAV_SECTIONS.flatMap((s) => s.items).map(({ label, to, icon: Icon }) => (
                <CommandItem key={to} value={`ir ${label}`} onSelect={() => run(() => navigate(to))}>
                  <Icon aria-hidden /> {label}
                </CommandItem>
              ))}
            </CommandGroup>

            {tasks.length > 0 && (
              <CommandGroup heading="Tarefas">
                {tasks.map((task) => (
                  <CommandItem
                    key={task.id}
                    value={`tarefa ${task.title} ${task.id}`}
                    keywords={[task.description ?? "", STATUS_LABELS[task.status]]}
                    onSelect={() => run(() => navigate(`/?editar=${task.id}`))}
                  >
                    <FileText aria-hidden />
                    <span className="truncate">{task.title}</span>
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">{STATUS_LABELS[task.status]}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            <CommandGroup heading="Tema">
              {THEMES.map(({ value, label, icon: Icon }) => (
                <CommandItem key={value} value={`tema ${label}`} onSelect={() => run(() => setTheme(value))}>
                  <Icon aria-hidden /> Tema {label.toLowerCase()}
                </CommandItem>
              ))}
            </CommandGroup>

            <CommandGroup heading="Conta">
              <CommandItem onSelect={() => run(logout)}>
                <LogOut aria-hidden /> Sair
              </CommandItem>
            </CommandGroup>
          </CommandList>
          <div className="flex items-center gap-3 border-t px-4 py-2 text-xs text-muted-foreground" aria-hidden>
            <span className="flex items-center gap-1">
              <kbd>↑</kbd>
              <kbd>↓</kbd> navegar
            </span>
            <span className="flex items-center gap-1">
              <kbd>
                <CornerDownLeft className="h-3 w-3" />
              </kbd>
              executar
            </span>
            <span className="flex items-center gap-1">
              <kbd>Esc</kbd> fechar
            </span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
