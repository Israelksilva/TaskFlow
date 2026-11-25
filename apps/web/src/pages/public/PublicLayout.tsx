import { useEffect, useState, type ReactNode } from "react";
import { Menu, X } from "lucide-react";
import { Link } from "react-router-dom";
import { Logo } from "@/components/layout/Logo";
import { Button, buttonVariants } from "@/components/ui/button";
import { useAuth } from "@/features/auth/use-auth";
import { cn } from "@/lib/utils";

import { SECTIONS, useScrollToSection } from "./sections";

function AuthActions({ compact = false }: { compact?: boolean }) {
  const { status } = useAuth();
  if (status === "authenticated") {
    return (
      <Link
        to="/app"
        className={buttonVariants({ variant: "brand", size: compact ? "sm" : "default" })}
      >
        Abrir o app
      </Link>
    );
  }
  return (
    <>
      <Link
        to="/entrar"
        className={buttonVariants({ variant: "ghost", size: compact ? "sm" : "default" })}
      >
        Entrar
      </Link>
      <Link
        to="/cadastro"
        className={buttonVariants({ variant: "brand", size: compact ? "sm" : "default" })}
      >
        Criar conta grátis
      </Link>
    </>
  );
}

function Navbar() {
  const scrollTo = useScrollToSection();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b transition-[background-color,border-color,box-shadow] duration-normal",
        scrolled || open
          ? "border-border bg-background/85 shadow-xs backdrop-blur supports-[backdrop-filter]:bg-background/70"
          : "border-transparent bg-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link to="/" aria-label="Andamo — início" className="rounded-md">
          <Logo />
        </Link>
        <nav aria-label="Seções da página" className="hidden flex-1 md:block">
          <ul className="flex items-center gap-1">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => scrollTo(s.id)}
                  className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  {s.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div className="ml-auto hidden items-center gap-2 md:flex">
          <AuthActions />
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto md:hidden"
          aria-expanded={open}
          aria-controls="menu-publico"
          aria-label={open ? "Fechar menu" : "Abrir menu"}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <X aria-hidden /> : <Menu aria-hidden />}
        </Button>
      </div>
      {open && (
        <div id="menu-publico" className="border-t px-4 pb-4 pt-2 md:hidden animate-fade-in">
          <nav aria-label="Seções da página (celular)">
            <ul className="space-y-1">
              {SECTIONS.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      scrollTo(s.id);
                    }}
                    className="w-full rounded-md px-3 py-2.5 text-left text-sm font-medium hover:bg-accent"
                  >
                    {s.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
          <div className="mt-3 flex gap-2 [&>a]:flex-1">
            <AuthActions compact />
          </div>
        </div>
      )}
    </header>
  );
}

function Footer() {
  const scrollTo = useScrollToSection();
  const linkClass = "text-sm text-muted-foreground transition-colors hover:text-foreground";
  return (
    <footer className="border-t bg-card/50">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="space-y-3">
          <Logo />
          <p className="max-w-xs text-sm text-muted-foreground">
            Organize seu trabalho. Conecte sua equipe. Faça acontecer.
          </p>
        </div>
        <nav aria-label="Produto">
          <h2 className="mb-3 text-sm font-semibold">Produto</h2>
          <ul className="space-y-2">
            {SECTIONS.slice(0, 4).map((s) => (
              <li key={s.id}>
                <button type="button" className={linkClass} onClick={() => scrollTo(s.id)}>
                  {s.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Conta">
          <h2 className="mb-3 text-sm font-semibold">Conta</h2>
          <ul className="space-y-2">
            <li>
              <Link to="/entrar" className={linkClass}>
                Entrar
              </Link>
            </li>
            <li>
              <Link to="/cadastro" className={linkClass}>
                Criar conta
              </Link>
            </li>
            <li>
              <button type="button" className={linkClass} onClick={() => scrollTo("contato")}>
                Fale conosco
              </button>
            </li>
          </ul>
        </nav>
        <nav aria-label="Legal">
          <h2 className="mb-3 text-sm font-semibold">Legal</h2>
          <ul className="space-y-2">
            <li>
              <Link to="/privacidade" className={linkClass}>
                Política de privacidade
              </Link>
            </li>
            <li>
              <Link to="/termos" className={linkClass}>
                Termos de uso
              </Link>
            </li>
          </ul>
        </nav>
      </div>
      <div className="border-t">
        <p className="mx-auto max-w-6xl px-4 py-5 text-xs text-muted-foreground sm:px-6">
          © {new Date().getFullYear()} Andamo · Desenvolvido por Israel Alcantara
        </p>
      </div>
    </footer>
  );
}

export function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
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
      <Navbar />
      <main id="conteudo" tabIndex={-1} className="flex-1 focus:outline-none">
        {children}
      </main>
      <Footer />
    </div>
  );
}
