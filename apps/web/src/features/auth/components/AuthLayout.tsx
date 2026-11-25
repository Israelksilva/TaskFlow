import type { ReactNode } from "react";
import { CheckCircle2, Cloud, Keyboard } from "lucide-react";
import { Logo, LogoMark } from "@/components/layout/Logo";

const HIGHLIGHTS = [
  { icon: CheckCircle2, text: "Arraste tarefas de A Fazer até Concluído" },
  { icon: Cloud, text: "Tudo salvo na nuvem, em qualquer dispositivo" },
  { icon: Keyboard, text: "Atalhos e navegação completa pelo teclado" },
];

/** Ilustração decorativa: um mini quadro em andamento. */
function BoardIllustration() {
  const columns = [
    { title: "A Fazer", dot: "bg-white/40", cards: [72, 48, 60] },
    { title: "Em Progresso", dot: "bg-primary-glow", cards: [64, 40], active: true },
    { title: "Concluído", dot: "bg-emerald-400", cards: [56, 70], done: true },
  ];
  return (
    <div aria-hidden className="grid grid-cols-3 gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
      {columns.map((col) => (
        <div key={col.title} className="space-y-2 rounded-xl bg-white/[0.04] p-2.5">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/60">
            <span className={`h-1.5 w-1.5 rounded-full ${col.dot}`} />
            {col.title}
          </p>
          {col.cards.map((w, i) => (
            <div
              key={i}
              className={`space-y-1.5 rounded-lg border border-white/10 bg-white/[0.07] p-2 ${col.active && i === 0 ? "-rotate-2 border-coral/70 bg-white/[0.12] shadow-lg shadow-black/30" : ""}`}
            >
              <div className="h-1.5 rounded-full bg-white/70" style={{ width: `${w}%` }} />
              <div className="h-1.5 w-2/3 rounded-full bg-white/25" />
              <div className="flex items-center gap-1 pt-0.5">
                <span className={`h-2 w-6 rounded-full ${col.done ? "bg-emerald-400/80" : i % 2 ? "bg-amber-300/80" : "bg-coral/80"}`} />
                {col.done && <span className="ml-auto h-2.5 w-2.5 rounded-full bg-emerald-400" />}
              </div>
            </div>
          ))}
        </div>
      ))}
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
      <aside className="relative hidden overflow-hidden bg-[hsl(248_42%_12%)] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        {/* Grade pontilhada sutil + um único brilho violeta: profundidade sem excesso de gradiente. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:radial-gradient(hsl(0_0%_100%/0.12)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:linear-gradient(to_bottom,black,transparent_85%)]"
        />
        <div aria-hidden className="pointer-events-none absolute -right-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-primary/30 blur-3xl" />

        <span className="relative flex items-center gap-2.5">
          <span className="rounded-[14px] bg-white/10 p-1 ring-1 ring-white/15">
            <LogoMark className="h-9 w-9" />
          </span>
          <span className="font-display text-2xl font-extrabold">Andamo</span>
        </span>

        <div className="relative max-w-lg space-y-8">
          <div className="space-y-4">
            <h2 className="font-display text-4xl font-extrabold leading-[1.1] xl:text-5xl">
              Seu trabalho,
              <br />
              <span className="text-coral">em andamento.</span>
            </h2>
            <p className="text-lg text-white/70">
              Um quadro leve e rápido para planejar, acompanhar e concluir o que importa.
            </p>
          </div>
          <BoardIllustration />
          <ul className="space-y-3">
            {HIGHLIGHTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm text-white/80">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 text-coral ring-1 ring-white/10">
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/50">© {new Date().getFullYear()} Andamo · por Israel Alcantara</p>
      </aside>

      {/* Formulário */}
      <div className="bg-brand-glow flex flex-col items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Logo markClassName="h-9 w-9" className="justify-center" />
          </div>
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
