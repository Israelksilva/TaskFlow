import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, Outlet, useMatch, useNavigate } from "react-router-dom";
import { WifiOff } from "lucide-react";
import type { AppNotification } from "@andamo/shared";
import { LoadingScreen } from "@/components/feedback/LoadingScreen";
import { InlineError } from "@/components/feedback/InlineError";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/features/auth/use-auth";
import { notificationsApi } from "@/features/notifications/api";
import { ProjectFormDialog } from "@/features/projects/components/ProjectFormDialog";
import { useRealtime } from "@/features/realtime/use-realtime";
import { QuickCreateDialog } from "@/features/tasks/components/QuickCreateDialog";
import { TaskDetailSheet } from "@/features/tasks/components/TaskDetailSheet";
import { CreateWorkspaceDialog } from "@/features/workspaces/components/CreateWorkspaceDialog";
import { CurrentWorkspaceContext, useWorkspaces } from "@/features/workspaces/hooks";
import { getErrorMessage } from "@/lib/api-client";
import { isTypingTarget, useMediaQuery, useOnline } from "@/lib/hooks";
import { sidebarStorage, workspaceStorage } from "@/lib/storage";
import { AppHeader, CrumbsContext, type Crumb } from "./AppHeader";
import { CommandPalette } from "./CommandPalette";
import { Sidebar } from "./Sidebar";

/** Layout autenticado de todo o app (/app/*). */
export function AppShell() {
  const { status } = useAuth();
  const navigate = useNavigate();
  const match = useMatch("/app/w/:workspaceId/*");
  const workspaces = useWorkspaces(status === "authenticated");
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const online = useOnline();

  const [collapsed, setCollapsed] = useState(() => sidebarStorage.get() === "collapsed");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [quickCreate, setQuickCreate] = useState(false);
  const [projectDialog, setProjectDialog] = useState(false);
  const [workspaceDialog, setWorkspaceDialog] = useState(false);
  const [crumbs, setCrumbs] = useState<Crumb[]>([]);

  const list = useMemo(() => workspaces.data ?? [], [workspaces.data]);
  const routeId = match?.params.workspaceId;
  const workspace = list.find((w) => w.id === (routeId ?? workspaceStorage.get())) ?? list[0];

  // Workspace recém-criado (ou convite recém-aceito) ainda não está no cache: recarrega antes de decidir.
  const missing = Boolean(routeId && workspaces.isSuccess && !list.some((w) => w.id === routeId));
  const [checked, setChecked] = useState<string | null>(null);
  useEffect(() => {
    if (missing && checked !== routeId) {
      void workspaces.refetch().finally(() => setChecked(routeId ?? null));
    }
  }, [missing, checked, routeId, workspaces]);

  useEffect(() => {
    if (workspace && !missing) workspaceStorage.set(workspace.id);
  }, [workspace, missing]);

  const openNotification = useCallback(
    (n: AppNotification) => {
      if (!n.readAt) void notificationsApi.markRead(n.id).catch(() => undefined);
      navigate(n.link ?? "/app/notificacoes");
    },
    [navigate],
  );
  const connection = useRealtime(status === "authenticated", openNotification);

  // Atalhos globais: Ctrl/⌘+K = comandos; N = nova tarefa (fora de campos de texto).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
        return;
      }
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target)) return;
      if (document.querySelector("[role=dialog], [role=alertdialog], [role=menu]")) return;
      if (e.key === "n" || e.key === "N") {
        // Na página do projeto, o quadro trata o "N" (cria na coluna certa).
        if (document.querySelector("[data-board-shortcuts]")) return;
        e.preventDefault();
        setQuickCreate(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const toggleCollapsed = () =>
    setCollapsed((c) => {
      sidebarStorage.set(c ? "expanded" : "collapsed");
      return !c;
    });

  if (workspaces.isPending) return <LoadingScreen label="Carregando seus workspaces…" />;
  if (workspaces.isError || !workspace) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-md space-y-3">
          <InlineError>{getErrorMessage(workspaces.error ?? new Error("Nenhum workspace encontrado"))}</InlineError>
          <Button onClick={() => void workspaces.refetch()}>Tentar novamente</Button>
        </div>
      </div>
    );
  }
  // Workspace inexistente ou sem acesso na URL → volta para um válido (após confirmar com o servidor).
  if (missing) {
    return checked === routeId && !workspaces.isFetching ? <Navigate to={`/app/w/${workspace.id}`} replace /> : <LoadingScreen label="Abrindo workspace…" />;
  }

  const sidebarProps = {
    workspace,
    workspaces: list,
    onCreateWorkspace: () => setWorkspaceDialog(true),
    onCreateProject: () => setProjectDialog(true),
  };

  return (
    <CurrentWorkspaceContext.Provider value={workspace}>
      <CrumbsContext.Provider value={setCrumbs}>
        <a href="#conteudo" className="sr-only z-50 rounded bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
          Pular para o conteúdo
        </a>
        <div className="flex h-screen overflow-hidden bg-background">
          {isDesktop ? (
            <Sidebar {...sidebarProps} collapsed={collapsed} onToggle={toggleCollapsed} />
          ) : (
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetContent side="left" className="w-64 p-0" hideClose aria-describedby={undefined}>
                <SheetTitle className="sr-only">Menu</SheetTitle>
                <Sidebar {...sidebarProps} collapsed={false} onNavigate={() => setMobileOpen(false)} />
              </SheetContent>
            </Sheet>
          )}
          <div className="flex min-w-0 flex-1 flex-col">
            <AppHeader
              crumbs={crumbs}
              connection={online ? connection : "offline"}
              onMenu={() => setMobileOpen(true)}
              onSearch={() => setPaletteOpen(true)}
              onQuickCreate={() => setQuickCreate(true)}
              onOpenNotification={openNotification}
            />
            {!online && (
              <div role="status" className="flex items-center justify-center gap-2 bg-warning/15 px-4 py-1.5 text-xs font-medium text-warning">
                <WifiOff className="h-3.5 w-3.5" aria-hidden /> Você está offline. Alterações serão possíveis assim que a conexão voltar.
              </div>
            )}
            <main id="conteudo" tabIndex={-1} className="scrollbar-thin flex-1 overflow-y-auto focus:outline-none">
              <Outlet />
            </main>
          </div>
        </div>

        <CommandPalette
          open={paletteOpen}
          onOpenChange={setPaletteOpen}
          workspace={workspace}
          workspaces={list}
          onCreateTask={() => setQuickCreate(true)}
          onCreateProject={() => setProjectDialog(true)}
        />
        <QuickCreateDialog open={quickCreate} onOpenChange={setQuickCreate} workspace={workspace} />
        <ProjectFormDialog open={projectDialog} onOpenChange={setProjectDialog} workspace={workspace} />
        <CreateWorkspaceDialog open={workspaceDialog} onOpenChange={setWorkspaceDialog} />
        <TaskDetailSheet workspace={workspace} />
      </CrumbsContext.Provider>
    </CurrentWorkspaceContext.Provider>
  );
}

/** /app → workspace atual (último usado ou o primeiro). */
export function AppIndex() {
  const workspaces = useWorkspaces();
  if (workspaces.isPending) return <LoadingScreen />;
  const list = workspaces.data ?? [];
  const ws = list.find((w) => w.id === workspaceStorage.get()) ?? list[0];
  return ws ? <Navigate to={`/app/w/${ws.id}`} replace /> : <Navigate to="/" replace />;
}
