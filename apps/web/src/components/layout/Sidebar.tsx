import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { NavLink } from "react-router-dom";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Logo, LogoMark } from "./Logo";
import { NAV_SECTIONS, type NavItem } from "./nav";

function NavEntry({ item, collapsed, onNavigate }: { item: NavItem; collapsed: boolean; onNavigate?: () => void }) {
  const { icon: Icon } = item;
  const link = (
    <NavLink
      to={item.to}
      end
      onClick={onNavigate}
      aria-label={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        cn(
          "group flex h-9 items-center gap-3 rounded-lg px-2.5 text-sm font-medium transition-colors duration-fast",
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground hover:bg-accent hover:text-foreground",
          collapsed && "justify-center px-0",
        )
      }
    >
      <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
      {!collapsed && <span className="truncate">{item.label}</span>}
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

/** Lista de navegação compartilhada entre a sidebar fixa e a gaveta do celular. */
export function SidebarNav({ collapsed = false, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  return (
    <nav aria-label="Navegação principal" className="flex-1 space-y-6 overflow-y-auto px-3 py-4 scrollbar-thin">
      {NAV_SECTIONS.map((section) => (
        <div key={section.label}>
          {collapsed ? (
            <div className="mx-2 mb-2 border-t" aria-hidden />
          ) : (
            <p className="mb-1.5 px-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {section.label}
            </p>
          )}
          <ul className="space-y-0.5">
            {section.items.map((item) => (
              <li key={item.to}>
                <NavEntry item={item} collapsed={collapsed} onNavigate={onNavigate} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/** Sidebar fixa (desktop), recolhível para uma faixa só de ícones. */
export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose;
  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 flex-col border-r bg-sidebar transition-[width] duration-normal ease-out lg:flex",
        collapsed ? "w-16" : "w-64",
      )}
    >
      <div className={cn("flex h-14 items-center border-b", collapsed ? "justify-center" : "px-5")}>
        {collapsed ? <LogoMark className="h-8 w-8" title="Andamo" /> : <Logo />}
      </div>
      <SidebarNav collapsed={collapsed} />
      <div className="border-t p-3">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={!collapsed}
          className={cn(
            "flex h-9 w-full items-center gap-3 rounded-lg px-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
            collapsed && "justify-center px-0",
          )}
        >
          <ToggleIcon className="h-[18px] w-[18px]" aria-hidden />
          {collapsed ? <span className="sr-only">Expandir menu</span> : <span>Recolher menu</span>}
        </button>
      </div>
    </aside>
  );
}
