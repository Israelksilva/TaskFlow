import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/layout/Logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/use-auth";

const NAV = [
  { href: "/#recursos", label: "Recursos" },
  { href: "/#beneficios", label: "Benefícios" },
  { href: "/#precos", label: "Preços" },
  { href: "/#faq", label: "Perguntas" },
  { href: "/ajuda", label: "Ajuda" },
];

export function PublicNavbar() {
  const { status } = useAuth();
  const [open, setOpen] = useState(false);
  const authed = status === "authenticated";
  return (
    <header className="sticky top-0 z-40 border-b border-transparent bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link to="/" aria-label="Andamo — início">
          <Logo />
        </Link>
        <nav aria-label="Seções" className="hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <Link key={n.href} to={n.href} className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto hidden items-center gap-2 md:flex">
          {authed ? (
            <Button asChild className="bg-brand text-white hover:brightness-110"><Link to="/app">Abrir o app</Link></Button>
          ) : (
            <>
              <Button asChild variant="ghost"><Link to="/entrar">Entrar</Link></Button>
              <Button asChild className="bg-brand text-white shadow-glow hover:brightness-110"><Link to="/cadastro">Começar grátis</Link></Button>
            </>
          )}
        </div>
        <Button variant="ghost" size="icon" className="ml-auto md:hidden" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label="Menu">
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>
      {open && (
        <nav aria-label="Menu" className="border-t bg-background px-4 py-3 md:hidden">
          {NAV.map((n) => (
            <Link key={n.href} to={n.href} onClick={() => setOpen(false)} className="block rounded-md px-3 py-2 text-sm font-medium">
              {n.label}
            </Link>
          ))}
          <div className="mt-2 grid grid-cols-2 gap-2">
            {authed ? (
              <Button asChild className="col-span-2"><Link to="/app">Abrir o app</Link></Button>
            ) : (
              <>
                <Button asChild variant="outline"><Link to="/entrar">Entrar</Link></Button>
                <Button asChild><Link to="/cadastro">Começar grátis</Link></Button>
              </>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t bg-card/50">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        <div className="space-y-3">
          <Logo />
          <p className="text-sm text-muted-foreground">Organize seu trabalho. Conecte sua equipe. Faça acontecer.</p>
        </div>
        <div>
          <h2 className="mb-3 text-sm font-semibold">Produto</h2>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link to="/#recursos" className="hover:text-foreground">Recursos</Link></li>
            <li><Link to="/#precos" className="hover:text-foreground">Planos e preços</Link></li>
            <li><Link to="/cadastro" className="hover:text-foreground">Criar conta</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="mb-3 text-sm font-semibold">Suporte</h2>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link to="/ajuda" className="hover:text-foreground">Central de ajuda</Link></li>
            <li><Link to="/#faq" className="hover:text-foreground">Perguntas frequentes</Link></li>
            <li><Link to="/#contato" className="hover:text-foreground">Fale conosco</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="mb-3 text-sm font-semibold">Legal</h2>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link to="/privacidade" className="hover:text-foreground">Política de privacidade</Link></li>
            <li><Link to="/termos" className="hover:text-foreground">Termos de uso</Link></li>
          </ul>
        </div>
      </div>
      <p className="border-t py-6 text-center text-xs text-muted-foreground">© {new Date().getFullYear()} Andamo. Todos os direitos reservados.</p>
    </footer>
  );
}

export function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PublicNavbar />
      <main id="conteudo" className="flex-1">{children}</main>
      <PublicFooter />
    </div>
  );
}
