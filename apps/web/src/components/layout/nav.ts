import { KanbanSquare, Palette, type LucideIcon } from "lucide-react";

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  /** Atalho exibido no menu e na paleta de comandos (apenas informativo). */
  hint?: string;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

/**
 * Navegação principal. Só entram itens que já funcionam: as demais áreas do
 * §6 (projetos, calendário, notificações…) chegam com as fases que as criam.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    label: "Workspace",
    items: [{ label: "Minhas tarefas", to: "/", icon: KanbanSquare }],
  },
  {
    label: "Sistema",
    items: [{ label: "Design system", to: "/design-system", icon: Palette }],
  },
];

/** Trilha de navegação por rota. */
export function breadcrumbsFor(pathname: string) {
  const root = { label: "Workspace", to: "/" };
  if (pathname === "/design-system") return [{ label: "Sistema" }, { label: "Design system" }];
  return [root, { label: "Minhas tarefas" }];
}
