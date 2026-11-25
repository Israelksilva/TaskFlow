import { useEffect, useState } from "react";
import {
  ArrowRight,
  Bell,
  Briefcase,
  CalendarClock,
  Check,
  Clock,
  Cloud,
  Command,
  FolderKanban,
  GripVertical,
  Keyboard,
  Moon,
  MousePointerClick,
  Search,
  Smartphone,
  Sparkles,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { ContactForm } from "./ContactForm";
import { PublicLayout } from "./PublicLayout";
import { scrollToSection, useScrollToSection } from "./sections";
import { Reveal } from "./Reveal";

const asset = (path: string) => `${import.meta.env.BASE_URL}${path}`;

/* ------------------------------------------------------------------ */
/* Conteúdo. Regra: só "Disponível" o que já existe no produto.        */
/* ------------------------------------------------------------------ */

const FEATURES: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: GripVertical,
    title: "Kanban com arrastar e soltar",
    text: "Mova tarefas entre A Fazer, Em Progresso e Concluído com o mouse, o toque ou o teclado.",
  },
  {
    icon: CalendarClock,
    title: "Prioridades e prazos",
    text: "Defina prioridade e data de entrega; tarefas atrasadas e para hoje ficam em destaque.",
  },
  {
    icon: Search,
    title: "Busca e filtros",
    text: "Encontre qualquer tarefa pelo texto e filtre por prioridade ou só as atrasadas.",
  },
  {
    icon: Cloud,
    title: "Salvo na nuvem",
    text: "Suas tarefas ficam na sua conta e aparecem iguais em qualquer dispositivo.",
  },
  {
    icon: Command,
    title: "Paleta de comandos",
    text: "Ctrl + K para criar, buscar, abrir tarefas e trocar o tema sem tirar a mão do teclado.",
  },
  {
    icon: Moon,
    title: "Tema claro e escuro",
    text: "Escolha o tema ou deixe o Andamo seguir a configuração do seu sistema.",
  },
  {
    icon: Smartphone,
    title: "Feito para o celular",
    text: "Colunas em abas, botão de criação ao alcance do polegar e menu em gaveta.",
  },
  {
    icon: Keyboard,
    title: "Acessível",
    text: "Navegação completa por teclado, leitores de tela e contraste verificados (WCAG 2.2 AA).",
  },
];

type Availability = "disponivel" | "desenvolvimento";

const PILLARS: {
  id: string;
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  text: string;
  status: Availability;
  items: string[];
  image?: { src: string; alt: string };
}[] = [
  {
    id: "produtividade",
    icon: Sparkles,
    eyebrow: "Produtividade",
    title: "Menos cliques, mais trabalho concluído",
    text: "O Andamo foi desenhado para ser rápido. Cada ação comum tem um atalho e o quadro responde na hora, mesmo antes de o servidor confirmar.",
    status: "disponivel",
    items: [
      "Atalhos: N cria tarefa, / busca, Ctrl + K abre a paleta",
      "Progresso do quadro, atrasadas e entregas do dia no topo",
      "Alterações salvas automaticamente, com indicador de salvamento",
      "Importação das tarefas da versão anterior do Andamo",
    ],
    image: {
      src: "screens/palette.webp",
      alt: "Paleta de comandos do Andamo aberta sobre o quadro, com ações, páginas e tarefas",
    },
  },
  {
    id: "projetos",
    icon: FolderKanban,
    eyebrow: "Gestão de projetos",
    title: "Vários projetos, cada um com seu quadro",
    text: "Hoje o Andamo tem um quadro pessoal. Estamos construindo projetos com colunas personalizadas e outras visões do mesmo trabalho.",
    status: "desenvolvimento",
    items: [
      "Projetos com membros, cores e arquivamento",
      "Colunas personalizáveis e limite de tarefas por coluna",
      "Visões em lista, tabela e calendário",
      "Subtarefas, checklists e etiquetas",
    ],
  },
  {
    id: "colaboracao",
    icon: Users,
    eyebrow: "Colaboração",
    title: "Sua equipe no mesmo quadro",
    text: "Workspaces para empresas, com convites, papéis e permissões, e o quadro atualizado em tempo real para todos.",
    status: "desenvolvimento",
    items: [
      "Workspaces, membros e equipes",
      "Papéis: proprietário, administrador, gerente, membro e convidado",
      "Comentários com menções",
      "Atualização em tempo real e histórico de atividades",
    ],
  },
  {
    id: "notificacoes",
    icon: Bell,
    eyebrow: "Notificações",
    title: "Saiba o que mudou, sem ficar procurando",
    text: "Avisos dentro do app, por e-mail e push quando você for atribuído, mencionado ou um prazo estiver chegando — com preferências por tipo.",
    status: "desenvolvimento",
    items: [
      "Central de notificações com contador de não lidas",
      "Lembretes antes do vencimento",
      "E-mail e notificações push",
      "Preferências e horário de silêncio",
    ],
  },
];

const PLANS: {
  name: string;
  price: string;
  description: string;
  available: boolean;
  items: string[];
  soon?: string[];
}[] = [
  {
    name: "Free",
    price: "R$ 0",
    description: "Para organizar o seu trabalho.",
    available: true,
    items: [
      "Quadro Kanban pessoal",
      "Prioridades, prazos, busca e filtros",
      "Acesso no computador e no celular",
    ],
    soon: ["Um workspace", "Até três projetos", "Notificações internas"],
  },
  {
    name: "Pro",
    price: "R$ 29,90",
    description: "Para profissionais e pequenos times.",
    available: false,
    items: [
      "Projetos ilimitados",
      "Colaboração",
      "Calendário",
      "Relatórios avançados",
      "Controle de tempo",
      "Automações",
      "Notificações push e e-mail",
    ],
  },
  {
    name: "Business",
    price: "R$ 79,90",
    description: "Para empresas com equipes e processos.",
    available: false,
    items: [
      "Gestão de equipes",
      "Permissões avançadas",
      "Auditoria",
      "Relatórios empresariais",
      "Integrações",
      "Maior armazenamento",
      "Automações avançadas",
    ],
  },
];

const FAQ = [
  {
    q: "O Andamo é gratuito?",
    a: "Sim. Tudo o que está disponível hoje é gratuito e não pedimos cartão de crédito. Os planos pagos serão lançados junto com os recursos que eles incluem, e você será avisado antes de qualquer cobrança.",
  },
  {
    q: "Preciso instalar alguma coisa?",
    a: "Não. O Andamo funciona no navegador, no computador, no tablet e no celular. Basta criar uma conta.",
  },
  {
    q: "Posso usar o Andamo com a minha equipe?",
    a: "Ainda não. Hoje cada conta tem o seu próprio quadro. Workspaces com membros, permissões e colaboração em tempo real estão em desenvolvimento.",
  },
  {
    q: "Meus dados ficam seguros?",
    a: "As senhas são guardadas com hash bcrypt (nunca em texto), a comunicação é criptografada (HTTPS) e cada conta só acessa as próprias tarefas. Veja os detalhes na Política de Privacidade.",
  },
  {
    q: "Usei o Andamo quando ele salvava no navegador. Perco minhas tarefas?",
    a: "Não. Ao entrar na sua conta no mesmo navegador, o Andamo oferece importar as tarefas antigas para a nuvem. Os dados originais continuam no navegador.",
  },
  {
    q: "Como excluo minha conta e meus dados?",
    a: "Envie uma mensagem pelo formulário de contato com o assunto “Privacidade e dados pessoais” usando o e-mail da conta. A exclusão pelo próprio app está prevista para as próximas versões.",
  },
];

/* ------------------------------------------------------------------ */

function BrowserFrame({
  src,
  alt,
  priority = false,
  className,
}: {
  src: string;
  alt: string;
  priority?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("overflow-hidden rounded-xl border bg-card shadow-lg", className)}>
      <div className="flex h-8 items-center gap-1.5 border-b bg-muted/60 px-3" aria-hidden>
        <span className="h-2.5 w-2.5 rounded-full bg-border" />
        <span className="h-2.5 w-2.5 rounded-full bg-border" />
        <span className="h-2.5 w-2.5 rounded-full bg-border" />
      </div>
      <img
        src={asset(src)}
        alt={alt}
        width={1440}
        height={900}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        className="block h-auto w-full"
      />
    </div>
  );
}

function SectionHeader({
  id,
  eyebrow,
  title,
  text,
}: {
  id: string;
  eyebrow: string;
  title: string;
  text?: string;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-sm font-semibold text-primary">{eyebrow}</p>
      <h2
        id={id}
        tabIndex={-1}
        className="mt-2 font-display focus:outline-none text-3xl font-extrabold tracking-tight sm:text-4xl"
      >
        {title}
      </h2>
      {text && <p className="mt-3 text-muted-foreground">{text}</p>}
    </div>
  );
}

function StatusBadge({ status }: { status: Availability }) {
  return status === "disponivel" ? (
    <Badge variant="success">Disponível</Badge>
  ) : (
    <Badge variant="outline" className="text-muted-foreground">
      Em desenvolvimento
    </Badge>
  );
}

function PrimaryCta({ className }: { className?: string }) {
  return (
    <Link
      to="/cadastro"
      className={buttonVariants({ variant: "brand", size: "lg", className: cn("px-6", className) })}
    >
      Criar conta grátis <ArrowRight aria-hidden />
    </Link>
  );
}

export default function LandingPage() {
  const scrollTo = useScrollToSection();
  const [prefersDark, setPrefersDark] = useState(false);
  const target = (useLocation().state as { scrollTo?: string } | null)?.scrollTo;

  useEffect(() => {
    if (!target) return;
    const id = requestAnimationFrame(() => scrollToSection(target));
    return () => cancelAnimationFrame(id);
  }, [target]);

  useEffect(() => {
    document.title = "Andamo — Organize seu trabalho. Conecte sua equipe. Faça acontecer.";
    setPrefersDark(document.documentElement.classList.contains("dark"));
  }, []);

  return (
    <PublicLayout>
      {/* Hero */}
      <section aria-labelledby="hero-titulo" className="relative overflow-hidden">
        <div aria-hidden className="bg-brand-glow pointer-events-none absolute inset-0" />
        <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-14 sm:px-6 sm:pt-20">
          <Reveal className="mx-auto max-w-3xl text-center">
            <Badge variant="brand" className="mb-5">
              Grátis para começar · sem cartão de crédito
            </Badge>
            <h1
              id="hero-titulo"
              className="font-display text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl"
            >
              <span className="block">Organize seu trabalho.</span>
              <span className="block text-primary">Conecte sua equipe.</span>
              <span className="block text-coral-strong">Faça acontecer.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
              O Andamo é um quadro Kanban rápido e acessível para planejar, acompanhar e concluir
              tarefas, com prioridades, prazos e tudo salvo na nuvem.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <PrimaryCta />
              <button
                type="button"
                onClick={() => scrollTo("funcionalidades")}
                className={buttonVariants({ variant: "outline", size: "lg", className: "px-6" })}
              >
                Ver funcionalidades
              </button>
            </div>
          </Reveal>
          <Reveal delay={120} className="mx-auto mt-14 max-w-5xl">
            <BrowserFrame
              priority
              src={prefersDark ? "screens/board-dark.webp" : "screens/board-light.webp"}
              alt="Quadro do Andamo com tarefas nas colunas A Fazer, Em Progresso e Concluído, com prioridades e prazos"
            />
          </Reveal>
        </div>
      </section>

      {/* Funcionalidades */}
      <section aria-labelledby="funcionalidades" className="scroll-mt-20 border-t bg-card/40 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeader
            id="funcionalidades"
            eyebrow="Funcionalidades"
            title="Tudo o que você usa hoje no Andamo"
            text="Recursos disponíveis agora, sem custo. Nada aqui é promessa."
          />
          <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map(({ icon: Icon, title, text }, i) => (
              <li key={title}>
                <Reveal delay={(i % 4) * 60} className="h-full">
                  <div className="h-full rounded-xl border bg-card p-5 shadow-xs transition-[box-shadow,transform] duration-normal hover:-translate-y-0.5 hover:shadow-md">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    <h3 className="mt-4 font-semibold">{title}</h3>
                    <p className="mt-1.5 text-sm text-muted-foreground">{text}</p>
                  </div>
                </Reveal>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Demonstração */}
      <section aria-labelledby="demonstracao" className="scroll-mt-20 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeader
            id="demonstracao"
            eyebrow="Demonstração"
            title="Veja o Andamo por dentro"
            text="Capturas de tela reais do sistema, com tarefas de exemplo."
          />
          <Tabs defaultValue="claro" className="mt-10 flex flex-col items-center">
            <TabsList aria-label="Capturas de tela">
              <TabsTrigger value="claro">Tema claro</TabsTrigger>
              <TabsTrigger value="escuro">Tema escuro</TabsTrigger>
              <TabsTrigger value="celular">Celular</TabsTrigger>
            </TabsList>
            <TabsContent value="claro" className="mt-8 w-full max-w-5xl">
              <BrowserFrame src="screens/board-light.webp" alt="Quadro do Andamo no tema claro" />
            </TabsContent>
            <TabsContent value="escuro" className="mt-8 w-full max-w-5xl">
              <BrowserFrame src="screens/board-dark.webp" alt="Quadro do Andamo no tema escuro" />
            </TabsContent>
            <TabsContent value="celular" className="mt-8 flex w-full justify-center">
              <div className="w-[300px] overflow-hidden rounded-[2rem] border-[6px] border-foreground/90 bg-card shadow-lg">
                <img
                  src={asset("screens/mobile.webp")}
                  alt="Andamo no celular: colunas em abas e botão Nova tarefa"
                  width={390}
                  height={844}
                  loading="lazy"
                  decoding="async"
                  className="block h-auto w-full"
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </section>

      {/* Pilares */}
      <section
        aria-label="Produtividade, projetos, colaboração e notificações"
        className="border-t bg-card/40 py-20"
      >
        <div className="mx-auto max-w-6xl space-y-20 px-4 sm:px-6">
          {PILLARS.map((p, i) => (
            <Reveal key={p.id}>
              <article
                aria-labelledby={`${p.id}-titulo`}
                className={cn(
                  "grid items-center gap-10 lg:grid-cols-2",
                  i % 2 === 1 && "lg:[&>*:first-child]:order-2",
                )}
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <p.icon className="h-5 w-5" aria-hidden />
                    </span>
                    <p className="text-sm font-semibold text-primary">{p.eyebrow}</p>
                    <StatusBadge status={p.status} />
                  </div>
                  <h2
                    id={`${p.id}-titulo`}
                    className="mt-4 font-display text-2xl font-extrabold tracking-tight sm:text-3xl"
                  >
                    {p.title}
                  </h2>
                  <p className="mt-3 text-muted-foreground">{p.text}</p>
                  <ul className="mt-6 space-y-2.5">
                    {p.items.map((item) => (
                      <li key={item} className="flex items-start gap-2.5 text-sm">
                        <Check
                          className={cn(
                            "mt-0.5 h-4 w-4 shrink-0",
                            p.status === "disponivel" ? "text-success" : "text-muted-foreground",
                          )}
                          aria-hidden
                        />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                {p.image ? (
                  <BrowserFrame src={p.image.src} alt={p.image.alt} />
                ) : (
                  <div className="flex aspect-[16/10] flex-col items-center justify-center rounded-xl border border-dashed bg-background/60 p-8 text-center">
                    <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                      <p.icon className="h-7 w-7" aria-hidden />
                    </span>
                    <p className="mt-4 font-medium">Em desenvolvimento</p>
                    <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                      Mostraremos capturas reais assim que o recurso estiver disponível.
                    </p>
                  </div>
                )}
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Benefícios */}
      <section aria-labelledby="beneficios" className="py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeader
            id="beneficios"
            eyebrow="Benefícios"
            title="Para quem trabalha sozinho e para quem lidera times"
          />
          <div className="mt-12 grid gap-5 md:grid-cols-2">
            <Reveal>
              <div className="h-full rounded-xl border bg-card p-6 shadow-xs">
                <div className="flex items-center gap-2.5">
                  <User className="h-5 w-5 text-primary" aria-hidden />
                  <h3 className="font-display text-lg font-bold">Profissionais</h3>
                  <Badge variant="success">Disponível</Badge>
                </div>
                <ul className="mt-5 space-y-2.5 text-sm">
                  {[
                    "Veja de relance o que está pendente, em andamento e pronto",
                    "Priorize o que importa e não perca prazos",
                    "Continue de onde parou, no computador ou no celular",
                    "Trabalhe rápido com atalhos e a paleta de comandos",
                  ].map((t) => (
                    <li key={t} className="flex gap-2.5">
                      <MousePointerClick
                        className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                        aria-hidden
                      />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
            <Reveal delay={80}>
              <div className="h-full rounded-xl border bg-card p-6 shadow-xs">
                <div className="flex items-center gap-2.5">
                  <Briefcase className="h-5 w-5 text-primary" aria-hidden />
                  <h3 className="font-display text-lg font-bold">Empresas e equipes</h3>
                  <Badge variant="outline" className="text-muted-foreground">
                    Em desenvolvimento
                  </Badge>
                </div>
                <ul className="mt-5 space-y-2.5 text-sm">
                  {[
                    "Um workspace por empresa, com membros e equipes",
                    "Permissões por papel e trilha de auditoria",
                    "Relatórios de andamento, carga de trabalho e prazos",
                    "Integrações e automações de rotina",
                  ].map((t) => (
                    <li key={t} className="flex gap-2.5 text-muted-foreground">
                      <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Planos */}
      <section aria-labelledby="planos" className="scroll-mt-20 border-t bg-card/40 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeader
            id="planos"
            eyebrow="Planos"
            title="Comece grátis. Cresça quando precisar."
            text="Hoje todos os recursos disponíveis são gratuitos. Os planos pagos chegam junto com os recursos que incluem — nenhuma cobrança é feita agora."
          />
          <ul className="mt-12 grid gap-5 lg:grid-cols-3">
            {PLANS.map((plan, i) => (
              <li key={plan.name}>
                <Reveal delay={i * 80} className="h-full">
                  <div
                    className={cn(
                      "flex h-full flex-col rounded-2xl border bg-card p-6 shadow-xs",
                      plan.available && "border-primary/40 ring-1 ring-primary/20",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-display text-xl font-bold">{plan.name}</h3>
                      {plan.available ? (
                        <Badge variant="success">Disponível</Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          Em breve
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
                    <p className="mt-5">
                      <span className="font-display text-4xl font-extrabold tracking-tight">
                        {plan.price}
                      </span>
                      <span className="text-sm text-muted-foreground">/mês</span>
                    </p>
                    <div className="mt-6 flex-1 space-y-5 text-sm">
                      <ul
                        className="space-y-2.5"
                        aria-label={plan.available ? "Incluído hoje" : "Incluirá"}
                      >
                        {plan.items.map((item) => (
                          <li key={item} className="flex gap-2.5">
                            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                            {item}
                          </li>
                        ))}
                      </ul>
                      {plan.soon && (
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Em breve no Free
                          </p>
                          <ul className="mt-2.5 space-y-2.5 text-muted-foreground">
                            {plan.soon.map((item) => (
                              <li key={item} className="flex gap-2.5">
                                <Clock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                    {plan.available ? (
                      <PrimaryCta className="mt-8 w-full" />
                    ) : (
                      <button
                        type="button"
                        onClick={() => scrollTo("contato")}
                        className={buttonVariants({
                          variant: "outline",
                          size: "lg",
                          className: "mt-8 w-full",
                        })}
                      >
                        Quero ser avisado
                      </button>
                    )}
                  </div>
                </Reveal>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-center text-xs text-muted-foreground">
            Valores iniciais por usuário/mês, sujeitos a ajuste até o lançamento. Os recursos de
            cada plano entram conforme forem lançados.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section aria-labelledby="perguntas" className="scroll-mt-20 py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <SectionHeader
            id="perguntas"
            eyebrow="Perguntas frequentes"
            title="Ficou alguma dúvida?"
          />
          <div className="mt-10 divide-y rounded-xl border bg-card">
            {FAQ.map(({ q, a }) => (
              <details key={q} className="group px-5 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-medium">
                  {q}
                  <span
                    aria-hidden
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-muted-foreground transition-transform duration-normal group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="pb-5 text-sm leading-relaxed text-muted-foreground">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Contato */}
      <section aria-labelledby="contato" className="scroll-mt-20 border-t bg-card/40 py-20">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_1.3fr]">
          <div>
            <p className="text-sm font-semibold text-primary">Contato</p>
            <h2
              id="contato"
              tabIndex={-1}
              className="mt-2 font-display text-3xl font-extrabold tracking-tight focus:outline-none sm:text-4xl"
            >
              Fale com a gente
            </h2>
            <p className="mt-3 text-muted-foreground">
              Dúvidas, sugestões, interesse nos planos ou pedidos sobre seus dados pessoais.
              Respondemos pelo e-mail que você informar.
            </p>
          </div>
          <ContactForm />
        </div>
      </section>

      {/* CTA final */}
      <section aria-labelledby="cta-final" className="py-20">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <Reveal>
            <h2
              id="cta-final"
              className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl"
            >
              Seu trabalho, em andamento.
            </h2>
            <p className="mt-3 text-muted-foreground">Crie sua conta em menos de um minuto.</p>
            <div className="mt-8">
              <PrimaryCta />
            </div>
          </Reveal>
        </div>
      </section>
    </PublicLayout>
  );
}
