import { Suspense, useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Menu, Plus, Search } from "lucide-react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AccountMenu } from "./AccountMenu";
import { CommandPalette } from "./CommandPalette";
import { Logo } from "./Logo";
import { breadcrumbsFor } from "./nav";
import { SaveIndicator } from "./SaveIndicator";
import { Sidebar, SidebarNav } from "./Sidebar";

const COLLAPSED_KEY = "andamo:sidebar-collapsed";
const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

/** Estrutura das páginas logadas: sidebar, header e conteúdo. */
export function AppShell() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSED_KEY, c ? "0" : "1");
      } catch {
        /* armazenamento indisponível: preferência vale só nesta sessão */
      }
      return !c;
    });
  }, []);

  // Ctrl/Cmd + K abre a paleta de qualquer lugar (inclusive com foco num campo).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex min-h-screen bg-background">
      <a
        href="#conteudo"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("conteudo")?.focus();
        }}
        className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Pular para o conteúdo
      </a>

      <Sidebar collapsed={collapsed} onToggle={toggleCollapsed} />

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="lg:hidden">
          <SheetTitle className="flex h-14 items-center border-b px-5">
            <Logo />
          </SheetTitle>
          <SheetDescription className="sr-only">Navegação principal</SheetDescription>
          <SidebarNav onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-card/85 px-3 backdrop-blur supports-[backdrop-filter]:bg-card/70 sm:gap-3 sm:px-5">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 lg:hidden"
            aria-label="Abrir menu"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(true)}
          >
            <Menu aria-hidden />
          </Button>

          <Breadcrumb items={breadcrumbsFor(pathname)} className="flex-1" />

          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            aria-keyshortcuts={isMac ? "Meta+K" : "Control+K"}
            className="hidden h-9 w-56 items-center gap-2 rounded-lg border bg-background px-3 text-sm text-muted-foreground shadow-xs transition-colors hover:bg-accent hover:text-foreground md:flex"
          >
            <Search className="h-4 w-4" aria-hidden />
            <span className="flex-1 text-left">
              Buscar<span className="sr-only"> ou executar comando</span>
            </span>
            <kbd aria-hidden>{isMac ? "⌘" : "Ctrl"}</kbd>
            <kbd aria-hidden>K</kbd>
          </button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 md:hidden"
            aria-label="Abrir paleta de comandos"
            onClick={() => setPaletteOpen(true)}
          >
            <Search aria-hidden />
          </Button>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9"
                aria-label="Criação rápida"
                onClick={() => navigate("/app?nova=1")}
              >
                <Plus aria-hidden />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Nova tarefa</TooltipContent>
          </Tooltip>

          <div className="hidden sm:block">
            <SaveIndicator />
          </div>
          <AccountMenu />
        </header>

        <main id="conteudo" tabIndex={-1} className="flex-1 focus:outline-none">
          <Suspense
            fallback={
              <div role="status" className="flex items-center gap-2 p-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Carregando…
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </main>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}
