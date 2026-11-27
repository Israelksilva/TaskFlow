import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  BarChart3,
  CalendarDays,
  Check,
  ChevronsUpDown,
  CircleHelp,
  CreditCard,
  FolderKanban,
  Inbox,
  LayoutDashboard,
  ListTodo,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Settings,
  SlidersHorizontal,
  Timer,
  Trash2,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { ROLE_LABELS, type Workspace } from "@andamo/shared";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useUnreadCount } from "@/features/notifications/hooks";
import { useProjects } from "@/features/workspaces/hooks";
import { cn } from "@/lib/utils";
import { LogoMark } from "./Logo";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  badge?: number;
}

function WorkspaceBadge({ ws, className }: { ws: Workspace; className?: string }) {
  return ws.logoUrl ? (
    <img src={ws.logoUrl} alt="" className={cn("h-7 w-7 rounded-lg object-cover", className)} />
  ) : (
    <span className={cn("flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-xs font-bold text-white", className)}>
      {ws.name.trim()[0]?.toUpperCase()}
    </span>
  );
}

function WorkspaceSwitcher({ current, workspaces, collapsed, onCreate }: { current: Workspace; workspaces: Workspace[]; collapsed: boolean; onCreate: () => void }) {
  const navigate = useNavigate();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left transition-colors hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-ring",
            collapsed && "justify-center",
          )}
          aria-label={`Workspace atual: ${current.name}. Trocar workspace`}
        >
          <WorkspaceBadge ws={current} />
          {!collapsed && (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-foreground">{current.name}</span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {current.plan.toUpperCase()} · {ROLE_LABELS[current.role]}
                </span>
              </span>
              <ChevronsUpDown className="h-4 w-4 text-muted-foreground" aria-hidden />
            </>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Workspaces</DropdownMenuLabel>
        {workspaces.map((ws) => (
          <DropdownMenuItem key={ws.id} onSelect={() => navigate(`/app/w/${ws.id}`)} className="gap-2.5">
            <WorkspaceBadge ws={ws} className="h-6 w-6" />
            <span className="min-w-0 flex-1 truncate">{ws.name}</span>
            {ws.id === current.id && <Check className="h-4 w-4 text-primary" aria-hidden />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onCreate} className="gap-2.5">
          <Plus className="h-4 w-4" aria-hidden /> Criar workspace
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NavItemLink({ item, collapsed, onNavigate }: { item: NavItem; collapsed: boolean; onNavigate?: () => void }) {
  const link = (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          "group relative flex h-9 items-center gap-3 rounded-lg px-2.5 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground",
          isActive && "bg-sidebar-accent text-foreground before:absolute before:-left-3 before:h-5 before:w-1 before:rounded-r-full before:bg-primary",
          collapsed && "justify-center px-0",
        )
      }
    >
      <item.icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
      {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
      {item.badge ? (
        <span
          className={cn(
            "flex h-5 min-w-5 items-center justify-center rounded-full bg-coral px-1.5 text-[10px] font-bold text-white",
            collapsed && "absolute right-0.5 top-0.5 h-4 min-w-4 px-1",
          )}
        >
          {item.badge > 99 ? "99+" : item.badge}
        </span>
      ) : null}
    </NavLink>
  );
  if (!collapsed) return link;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  );
}

export function Sidebar({
  workspace,
  workspaces,
  collapsed,
  onToggle,
  onNavigate,
  onCreateWorkspace,
  onCreateProject,
}: {
  workspace: Workspace;
  workspaces: Workspace[];
  collapsed: boolean;
  onToggle?: () => void;
  onNavigate?: () => void;
  onCreateWorkspace: () => void;
  onCreateProject: () => void;
}) {
  const unread = useUnreadCount().data ?? 0;
  const projects = useProjects(workspace.id).data ?? [];
  const [showAllProjects, setShowAllProjects] = useState(false);
  const base = `/app/w/${workspace.id}`;

  const main: NavItem[] = [
    { to: base, label: "Visão geral", icon: LayoutDashboard, end: true },
    { to: "/app/notificacoes", label: "Caixa de entrada", icon: Inbox, badge: unread },
    { to: `${base}/minhas-tarefas`, label: "Minhas tarefas", icon: ListTodo },
    { to: `${base}/projetos`, label: "Projetos", icon: FolderKanban, end: true },
    { to: `${base}/calendario`, label: "Calendário", icon: CalendarDays },
    { to: `${base}/tempo`, label: "Controle de tempo", icon: Timer },
    { to: `${base}/relatorios`, label: "Relatórios", icon: BarChart3 },
    { to: `${base}/automacoes`, label: "Automações", icon: Zap },
    { to: `${base}/equipe`, label: "Equipe", icon: Users },
  ];
  const footer: NavItem[] = [
    { to: `${base}/lixeira`, label: "Lixeira", icon: Trash2 },
    { to: `${base}/ajustes`, label: "Ajustes do workspace", icon: SlidersHorizontal },
    { to: `${base}/planos`, label: "Planos e assinatura", icon: CreditCard },
    { to: "/app/configuracoes", label: "Configurações", icon: Settings },
    { to: "/ajuda", label: "Ajuda e suporte", icon: CircleHelp },
  ];
  const visibleProjects = showAllProjects ? projects : projects.slice(0, 6);

  return (
    <nav
      aria-label="Navegação principal"
      className={cn("flex h-full flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200", collapsed ? "w-[68px]" : "w-64")}
    >
      <div className={cn("flex h-14 items-center gap-2 px-3", collapsed && "justify-center px-0")}>
        <LogoMark className="h-7 w-7" />
        {!collapsed && <span className="font-display text-lg font-extrabold tracking-tight">Andamo</span>}
        {onToggle && !collapsed && (
          <Button variant="ghost" size="icon" className="ml-auto h-8 w-8" onClick={onToggle} aria-label="Recolher menu">
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="px-3 pb-2">
        <WorkspaceSwitcher current={workspace} workspaces={workspaces} collapsed={collapsed} onCreate={onCreateWorkspace} />
      </div>

      <div className="scrollbar-thin flex-1 space-y-6 overflow-y-auto px-3 py-2">
        <div className="space-y-0.5">
          {main.map((item) => (
            <NavItemLink key={item.to} item={item} collapsed={collapsed} onNavigate={onNavigate} />
          ))}
        </div>

        {!collapsed && (
          <div>
            <div className="mb-1 flex items-center justify-between px-2.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Projetos</span>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onCreateProject} aria-label="Novo projeto">
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="space-y-0.5">
              {visibleProjects.map((p) => (
                <NavLink
                  key={p.id}
                  to={`${base}/projetos/${p.id}`}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn(
                      "flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground",
                      isActive && "bg-sidebar-accent font-medium text-foreground",
                    )
                  }
                >
                  <span className="h-2.5 w-2.5 shrink-0 rounded-[4px]" style={{ background: p.color }} aria-hidden />
                  <span className="flex-1 truncate">{p.name}</span>
                  {p.taskCount > 0 && <span className="text-[11px] tabular-nums text-muted-foreground">{p.taskCount - p.doneCount}</span>}
                </NavLink>
              ))}
              {projects.length > 6 && (
                <button className="px-2.5 py-1 text-xs font-medium text-primary hover:underline" onClick={() => setShowAllProjects((v) => !v)}>
                  {showAllProjects ? "Mostrar menos" : `Ver todos (${projects.length})`}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-0.5 border-t border-sidebar-border px-3 py-3">
        {footer.map((item) => (
          <NavItemLink key={item.to} item={item} collapsed={collapsed} onNavigate={onNavigate} />
        ))}
        {onToggle && collapsed && (
          <Button variant="ghost" size="icon" className="mx-auto mt-1 flex h-9 w-9" onClick={onToggle} aria-label="Expandir menu">
            <PanelLeftOpen className="h-4 w-4" />
          </Button>
        )}
      </div>
    </nav>
  );
}
