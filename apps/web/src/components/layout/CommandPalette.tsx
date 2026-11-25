import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Command } from "cmdk";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import {
  CalendarDays,
  CheckSquare,
  Clock,
  FolderKanban,
  Inbox,
  LayoutDashboard,
  ListTodo,
  Loader2,
  MessageSquare,
  Moon,
  Plus,
  Search,
  Settings,
  Sun,
  Users,
} from "lucide-react";
import type { Workspace } from "@andamo/shared";
import { workspacesApi } from "@/features/workspaces/api";
import { useDebouncedValue } from "@/lib/hooks";
import { searchHistoryStorage } from "@/lib/storage";

function readHistory(): string[] {
  try {
    return (JSON.parse(searchHistoryStorage.get() ?? "[]") as string[]).slice(0, 6);
  } catch {
    return [];
  }
}

function pushHistory(term: string) {
  const next = [term, ...readHistory().filter((t) => t !== term)].slice(0, 6);
  searchHistoryStorage.set(JSON.stringify(next));
}

const itemClass =
  "flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm aria-selected:bg-accent aria-selected:text-foreground [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground";
const groupClass = "px-1 py-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground";

export function CommandPalette({
  open,
  onOpenChange,
  workspace,
  workspaces,
  onCreateTask,
  onCreateProject,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspace: Workspace;
  workspaces: Workspace[];
  onCreateTask: () => void;
  onCreateProject: () => void;
}) {
  const navigate = useNavigate();
  const { resolvedTheme, setTheme } = useTheme();
  const [term, setTerm] = useState("");
  const debounced = useDebouncedValue(term.trim(), 250);
  const base = `/app/w/${workspace.id}`;

  useEffect(() => {
    if (!open) setTerm("");
  }, [open]);

  const results = useQuery({
    queryKey: ["search", workspace.id, debounced],
    queryFn: ({ signal }) => workspacesApi.search(workspace.id, debounced, signal),
    enabled: open && debounced.length >= 2,
    staleTime: 15_000,
  });

  const go = (to: string) => {
    if (debounced.length >= 2) pushHistory(debounced);
    onOpenChange(false);
    navigate(to);
  };
  const run = (fn: () => void) => {
    onOpenChange(false);
    fn();
  };
  const r = results.data;
  const history = readHistory();

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-[12vh] z-50 w-[min(94vw,640px)] -translate-x-1/2 overflow-hidden rounded-2xl border bg-popover shadow-elevated data-[state=open]:animate-pop-in"
          aria-describedby={undefined}
        >
          <DialogPrimitive.Title className="sr-only">Buscar e executar comandos</DialogPrimitive.Title>
          <Command shouldFilter={debounced.length < 2} loop>
            <div className="flex items-center gap-2 border-b px-4">
              <Search className="h-4 w-4 text-muted-foreground" aria-hidden />
              <Command.Input
                value={term}
                onValueChange={setTerm}
                placeholder="Busque tarefas, projetos, pessoas… ou digite um comando"
                className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              {results.isFetching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Buscando" />}
            </div>
            <Command.List className="scrollbar-thin max-h-[60vh] overflow-y-auto p-2">
              <Command.Empty className="px-3 py-8 text-center text-sm text-muted-foreground">
                {debounced.length >= 2 && !results.isFetching ? "Nada encontrado." : "Digite ao menos 2 caracteres para buscar."}
              </Command.Empty>

              {r && debounced.length >= 2 && (
                <>
                  {r.tasks.length > 0 && (
                    <Command.Group heading="Tarefas" className={groupClass}>
                      {r.tasks.map((t) => (
                        <Command.Item key={t.id} value={`task-${t.id}`} className={itemClass} onSelect={() => go(`${base}/projetos/${t.projectId}?tarefa=${t.id}`)}>
                          <CheckSquare /> <span className="truncate">{t.title}</span>
                        </Command.Item>
                      ))}
                    </Command.Group>
                  )}
                  {r.projects.length > 0 && (
                    <Command.Group heading="Projetos" className={groupClass}>
                      {r.projects.map((p) => (
                        <Command.Item key={p.id} value={`project-${p.id}`} className={itemClass} onSelect={() => go(`${base}/projetos/${p.id}`)}>
                          <span className="h-3 w-3 rounded" style={{ background: p.color }} aria-hidden /> {p.name}
                        </Command.Item>
                      ))}
                    </Command.Group>
                  )}
                  {(r.members.length > 0 || r.teams.length > 0) && (
                    <Command.Group heading="Pessoas e equipes" className={groupClass}>
                      {r.members.map((m) => (
                        <Command.Item key={m.id} value={`member-${m.id}`} className={itemClass} onSelect={() => go(`${base}/equipe`)}>
                          <Users /> {m.name}
                        </Command.Item>
                      ))}
                      {r.teams.map((t) => (
                        <Command.Item key={t.id} value={`team-${t.id}`} className={itemClass} onSelect={() => go(`${base}/equipe`)}>
                          <Users /> Equipe {t.name}
                        </Command.Item>
                      ))}
                    </Command.Group>
                  )}
                  {r.comments.length > 0 && (
                    <Command.Group heading="Comentários" className={groupClass}>
                      {r.comments.map((c) => (
                        <Command.Item key={c.id} value={`comment-${c.id}`} className={itemClass} onSelect={() => go(`${base}/minhas-tarefas?tarefa=${c.taskId}`)}>
                          <MessageSquare /> <span className="truncate">{c.excerpt}</span>
                        </Command.Item>
                      ))}
                    </Command.Group>
                  )}
                </>
              )}

              {debounced.length < 2 && (
                <>
                  {history.length > 0 && !term && (
                    <Command.Group heading="Buscas recentes" className={groupClass}>
                      {history.map((h) => (
                        <Command.Item key={h} value={`history ${h}`} className={itemClass} onSelect={() => setTerm(h)}>
                          <Clock /> {h}
                        </Command.Item>
                      ))}
                    </Command.Group>
                  )}
                  <Command.Group heading="Ações" className={groupClass}>
                    <Command.Item value="nova tarefa criar" className={itemClass} onSelect={() => run(onCreateTask)}>
                      <Plus /> Nova tarefa <kbd className="ml-auto">N</kbd>
                    </Command.Item>
                    <Command.Item value="novo projeto criar" className={itemClass} onSelect={() => run(onCreateProject)}>
                      <FolderKanban /> Novo projeto
                    </Command.Item>
                    <Command.Item value="alternar tema escuro claro" className={itemClass} onSelect={() => run(() => setTheme(resolvedTheme === "dark" ? "light" : "dark"))}>
                      {resolvedTheme === "dark" ? <Sun /> : <Moon />} Alternar tema
                    </Command.Item>
                  </Command.Group>
                  <Command.Group heading="Ir para" className={groupClass}>
                    {[
                      { to: base, label: "Visão geral", icon: LayoutDashboard },
                      { to: "/app/notificacoes", label: "Caixa de entrada", icon: Inbox },
                      { to: `${base}/minhas-tarefas`, label: "Minhas tarefas", icon: ListTodo },
                      { to: `${base}/projetos`, label: "Projetos", icon: FolderKanban },
                      { to: `${base}/calendario`, label: "Calendário", icon: CalendarDays },
                      { to: `${base}/equipe`, label: "Equipe", icon: Users },
                      { to: "/app/configuracoes", label: "Configurações", icon: Settings },
                    ].map((item) => (
                      <Command.Item key={item.to} value={`ir ${item.label}`} className={itemClass} onSelect={() => go(item.to)}>
                        <item.icon /> {item.label}
                      </Command.Item>
                    ))}
                  </Command.Group>
                  {workspaces.length > 1 && (
                    <Command.Group heading="Trocar workspace" className={groupClass}>
                      {workspaces
                        .filter((w) => w.id !== workspace.id)
                        .map((w) => (
                          <Command.Item key={w.id} value={`workspace ${w.name}`} className={itemClass} onSelect={() => go(`/app/w/${w.id}`)}>
                            <span className="flex h-4 w-4 items-center justify-center rounded bg-brand text-[9px] font-bold text-white">{w.name[0]}</span> {w.name}
                          </Command.Item>
                        ))}
                    </Command.Group>
                  )}
                </>
              )}
            </Command.List>
            <div className="flex items-center gap-3 border-t px-4 py-2 text-[11px] text-muted-foreground">
              <span><kbd>↑</kbd> <kbd>↓</kbd> navegar</span>
              <span><kbd>Enter</kbd> abrir</span>
              <span><kbd>Esc</kbd> fechar</span>
            </div>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
