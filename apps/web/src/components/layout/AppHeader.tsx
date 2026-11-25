import { Fragment, createContext, useContext, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronRight, LogOut, Menu, Monitor, Moon, Plus, Search, Settings, Shield, Sun, WifiOff } from "lucide-react";
import { useTheme } from "next-themes";
import type { AppNotification } from "@andamo/shared";
import { UserAvatar } from "@/components/feedback/UserAvatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/features/auth/use-auth";
import { NotificationBell } from "@/features/notifications/components/NotificationBell";
import { RunningTimer } from "@/features/time/components/RunningTimer";
import { SaveIndicator } from "./SaveIndicator";

export interface Crumb {
  label: string;
  to?: string;
}

/** Páginas informam seus breadcrumbs ao header (e o título da aba do navegador). */
export const CrumbsContext = createContext<(crumbs: Crumb[]) => void>(() => undefined);

export function useCrumbs(crumbs: Crumb[]) {
  const set = useContext(CrumbsContext);
  const key = JSON.stringify(crumbs);
  useEffect(() => {
    set(crumbs);
    const last = crumbs[crumbs.length - 1]?.label;
    document.title = last ? `${last} · Andamo` : "Andamo";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, set]);
}

export function AppHeader({
  crumbs,
  connection,
  onMenu,
  onSearch,
  onQuickCreate,
  onOpenNotification,
}: {
  crumbs: Crumb[];
  connection: "connecting" | "online" | "offline";
  onMenu: () => void;
  onSearch: () => void;
  onQuickCreate: () => void;
  onOpenNotification: (n: AppNotification) => void;
}) {
  const { user, logout } = useAuth();
  const { theme = "system", setTheme } = useTheme();
  const navigate = useNavigate();
  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-card/80 px-3 backdrop-blur supports-[backdrop-filter]:bg-card/70 sm:px-5">
      <Button variant="ghost" size="icon" className="h-9 w-9 lg:hidden" onClick={onMenu} aria-label="Abrir menu">
        <Menu className="h-5 w-5" />
      </Button>

      <nav aria-label="Você está em" className="hidden min-w-0 items-center gap-1 text-sm md:flex">
        {crumbs.map((c, i) => (
          <Fragment key={`${c.label}-${i}`}>
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />}
            {c.to && i < crumbs.length - 1 ? (
              <Link to={c.to} className="truncate text-muted-foreground transition-colors hover:text-foreground">
                {c.label}
              </Link>
            ) : (
              <span className="truncate font-medium" aria-current={i === crumbs.length - 1 ? "page" : undefined}>
                {c.label}
              </span>
            )}
          </Fragment>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-1.5">
        {connection === "offline" && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex items-center gap-1 rounded-full bg-warning/10 px-2 py-1 text-xs font-medium text-warning" role="status">
                <WifiOff className="h-3.5 w-3.5" aria-hidden /> <span className="hidden sm:inline">Reconectando…</span>
              </span>
            </TooltipTrigger>
            <TooltipContent>Sem conexão em tempo real. As alterações de outras pessoas aparecerão quando reconectar.</TooltipContent>
          </Tooltip>
        )}
        <RunningTimer />
        <div className="hidden xl:block">
          <SaveIndicator />
        </div>
        <button
          onClick={onSearch}
          className="flex h-9 items-center gap-2 rounded-lg border bg-background/60 px-2.5 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground sm:w-56"
          aria-label="Buscar e comandos"
        >
          <Search className="h-4 w-4" aria-hidden />
          <span className="hidden flex-1 text-left sm:inline">Buscar…</span>
          <kbd className="hidden sm:inline-flex">{isMac ? "⌘" : "Ctrl"} K</kbd>
        </button>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" className="h-9 w-9 bg-brand text-white shadow-glow hover:brightness-110" onClick={onQuickCreate} aria-label="Criar tarefa">
              <Plus className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            Nova tarefa <kbd className="ml-1">N</kbd>
          </TooltipContent>
        </Tooltip>
        <NotificationBell onOpen={onOpenNotification} />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" aria-label="Menu da conta">
              {user && <UserAvatar user={user} className="h-8 w-8 ring-0" />}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel className="font-normal">
              <p className="truncate text-sm font-medium">{user?.name}</p>
              <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => navigate("/app/configuracoes")}>
              <Settings className="mr-2 h-4 w-4" aria-hidden /> Configurações
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => navigate("/app/configuracoes/seguranca")}>
              <Shield className="mr-2 h-4 w-4" aria-hidden /> Segurança e sessões
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Tema</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
              <DropdownMenuRadioItem value="light">
                <Sun className="mr-2 h-4 w-4" aria-hidden /> Claro
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="dark">
                <Moon className="mr-2 h-4 w-4" aria-hidden /> Escuro
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="system">
                <Monitor className="mr-2 h-4 w-4" aria-hidden /> Automático
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => void logout()}>
              <LogOut className="mr-2 h-4 w-4" aria-hidden /> Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
