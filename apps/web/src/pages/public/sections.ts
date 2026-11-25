import { useLocation, useNavigate } from "react-router-dom";

export const SECTIONS = [
  { id: "funcionalidades", label: "Funcionalidades" },
  { id: "demonstracao", label: "Demonstração" },
  { id: "planos", label: "Planos" },
  { id: "perguntas", label: "Perguntas" },
  { id: "contato", label: "Contato" },
] as const;

/**
 * Rolagem até uma seção da landing. Com HashRouter, `href="#secao"` trocaria a
 * rota; por isso a navegação interna usa botões + scrollIntoView.
 */
export function scrollToSection(id: string) {
  const el = document.getElementById(id);
  if (!el) return false;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  el.focus({ preventScroll: true });
  return true;
}

/** Fora da landing, navega para "/" levando a seção no state; a landing rola ao montar. */
export function useScrollToSection() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  return (id: string) => {
    if (pathname === "/") scrollToSection(id);
    else navigate("/", { state: { scrollTo: id } });
  };
}
