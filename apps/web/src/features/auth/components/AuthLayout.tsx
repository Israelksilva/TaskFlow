import type { ReactNode } from "react";
import { CheckCircle2, Cloud, Keyboard } from "lucide-react";
import { Link } from "react-router-dom";
import { Logo, LogoMark } from "@/components/layout/Logo";

const HIGHLIGHTS = [
  { icon: CheckCircle2, text: "Kanban com arrastar e soltar" },
  { icon: Cloud, text: "Salvo na nuvem" },
  { icon: Keyboard, text: "Atalhos de teclado" },
];

/** Captura real do quadro, "saindo" do painel como nas vitrines de produto. */
function ProductPreview() {
  return (
    <div aria-hidden className="relative -mr-24 overflow-hidden rounded-xl border border-white/20 bg-white shadow-2xl shadow-black/30 xl:-mr-32">
      <div className="flex h-6 items-center gap-1.5 border-b border-black/5 bg-slate-50 px-3">
        <span className="h-2 w-2 rounded-full bg-slate-300" />
        <span className="h-2 w-2 rounded-full bg-slate-300" />
        <span className="h-2 w-2 rounded-full bg-slate-300" />
      </div>
      <img
        src={`${import.meta.env.BASE_URL}screens/board-light.webp`}
        alt=""
        width={1440}
        height={900}
        decoding="async"
        className="block h-auto w-full"
      />
    </div>
  );
}

export function AuthLayout({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[1.05fr_1fr]">
      {/* Painel da marca (desktop) */}
      <aside className="relative hidden overflow-hidden bg-[hsl(248_78%_56%)] p-12 text-white lg:flex lg:flex-col lg:gap-10">
        {/* Faixas diagonais suaves + brilho coral: profundidade sem poluir. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,hsl(0_0%_100%/0.14)_0%,transparent_38%,transparent_62%,hsl(0_0%_100%/0.06)_100%)]" />
        <div aria-hidden className="pointer-events-none absolute -bottom-40 -left-24 h-[26rem] w-[26rem] rounded-full bg-coral/30 blur-3xl" />

        <Link to="/" className="relative flex w-fit items-center gap-2.5 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
          <span className="rounded-[14px] bg-white/15 p-1 ring-1 ring-white/25">
            <LogoMark className="h-9 w-9" />
          </span>
          <span className="font-display text-2xl font-extrabold">Andamo</span>
          <span className="sr-only"> — voltar ao início</span>
        </Link>

        <div className="relative max-w-lg space-y-4">
          <h2 className="font-display text-4xl font-extrabold leading-[1.1] xl:text-5xl">
            Organize seu trabalho.
            <br />
            Faça acontecer.
          </h2>
          <p className="text-lg text-white/90">Um quadro rápido e acessível para planejar, acompanhar e concluir o que importa.</p>
          <ul className="flex flex-wrap gap-2 pt-2">
            {HIGHLIGHTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium ring-1 ring-white/20">
                <Icon className="h-3.5 w-3.5" aria-hidden />
                {text}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative mt-auto">
          <ProductPreview />
        </div>
      </aside>

      {/* Formulário */}
      <div className="bg-brand-glow flex flex-col items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-sm">
          <Link to="/" className="mb-8 flex justify-center rounded-lg lg:hidden" aria-label="Andamo — início">
            <Logo markClassName="h-9 w-9" />
          </Link>
          <main>
            <h1 className="font-display text-3xl font-extrabold tracking-tight">{title}</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
            <div className="mt-8">{children}</div>
          </main>
          <p className="mt-8 text-center text-sm text-muted-foreground">{footer}</p>
        </div>
      </div>
    </div>
  );
}
