import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import {
  AtSign,
  BellRing,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Columns3,
  Command,
  Gauge,
  Loader2,
  Lock,
  MailCheck,
  Repeat,
  ShieldCheck,
  Smartphone,
  Users,
  Zap,
} from "lucide-react";
import { contactSchema } from "@andamo/shared";
import { InlineError } from "@/components/feedback/InlineError";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PlanComparison, PricingCards } from "@/features/billing/PricingTable";
import { apiRequest, getErrorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { FAQ } from "./content";
import { PublicLayout } from "./PublicLayout";

const FEATURES = [
  { icon: Columns3, title: "Kanban, lista, tabela e timeline", text: "Arraste tarefas entre colunas, agrupe por responsável ou prioridade e enxergue prazos numa linha do tempo." },
  { icon: BellRing, title: "Notificações que importam", text: "Atribuições, menções, prazos e mudanças chegam na hora — na central, por push e por e-mail, com horário silencioso." },
  { icon: AtSign, title: "Colaboração em tempo real", text: "Comentários com @menções, reações e respostas. Veja quem está olhando a mesma tarefa e as mudanças aparecerem ao vivo." },
  { icon: CalendarDays, title: "Calendário e lembretes", text: "Visões de mês, semana, dia e agenda. Arraste para remarcar e exporte para seu calendário em .ics." },
  { icon: Users, title: "Workspaces e permissões", text: "Equipes, convites por e-mail e seis papéis — de proprietário a visualizador — com dados isolados por organização." },
  { icon: Repeat, title: "Tarefas completas", text: "Subtarefas, checklists, dependências, recorrência, etiquetas, estimativas, lixeira e histórico de alterações." },
];

const BENEFITS = [
  { icon: Gauge, title: "Clareza do que vem a seguir", text: "Um painel com dados reais: o que está atrasado, o que vence esta semana e como cada projeto avança." },
  { icon: Command, title: "Rápido como o seu pensamento", text: "Atalhos de teclado e paleta de comandos (Ctrl+K) para criar, buscar e navegar sem tirar as mãos do teclado." },
  { icon: Smartphone, title: "Em qualquer lugar", text: "Responsivo do celular ao monitor ultrawide, instalável como aplicativo e com tema claro, escuro ou automático." },
  { icon: ShieldCheck, title: "Segurança desde o início", text: "Verificação em duas etapas, sessões revogáveis, proteção contra força bruta e conformidade com a LGPD." },
];

function ProductDemo() {
  const columns = [
    { title: "A Fazer", tone: "bg-slate-400", cards: [{ t: "Briefing com o cliente", p: "Alta", c: "bg-rose-500/15 text-rose-600 dark:text-rose-300" }, { t: "Pesquisa de referências", p: "Média", c: "bg-amber-500/15 text-amber-600 dark:text-amber-300" }] },
    { title: "Em Progresso", tone: "bg-primary", cards: [{ t: "Wireframes da home", p: "Urgente", c: "bg-red-600 text-white", active: true }, { t: "Plano de conteúdo", p: "Média", c: "bg-amber-500/15 text-amber-600 dark:text-amber-300" }] },
    { title: "Concluído", tone: "bg-emerald-500", cards: [{ t: "Kickoff do projeto", p: "Baixa", c: "bg-muted text-muted-foreground", done: true }] },
  ];
  return (
    <div aria-hidden className="relative mx-auto max-w-5xl">
      <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-brand opacity-20 blur-3xl" />
      <div className="overflow-hidden rounded-2xl border bg-card shadow-elevated">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <span className="h-3 w-3 rounded-full bg-rose-400" /><span className="h-3 w-3 rounded-full bg-amber-400" /><span className="h-3 w-3 rounded-full bg-emerald-400" />
          <span className="ml-3 rounded-md bg-muted px-3 py-1 text-xs text-muted-foreground">Projeto · Novo site institucional</span>
          <span className="ml-auto flex -space-x-1.5">
            {["#6D5DFC", "#FF8A65", "#2BB673"].map((c) => <span key={c} className="h-6 w-6 rounded-full ring-2 ring-card" style={{ background: c }} />)}
          </span>
        </div>
        <div className="grid gap-3 bg-muted/30 p-4 sm:grid-cols-3">
          {columns.map((col) => (
            <div key={col.title} className="space-y-2 rounded-xl bg-background/70 p-3">
              <p className="flex items-center gap-2 text-xs font-semibold"><span className={cn("h-2 w-2 rounded-full", col.tone)} /> {col.title}</p>
              {col.cards.map((card) => (
                <div key={card.t} className={cn("space-y-2 rounded-lg border bg-card p-3 shadow-card", "active" in card && card.active && "rotate-[-1.5deg] border-primary/50 shadow-glow")}>
                  <p className={cn("text-sm font-medium", "done" in card && card.done && "text-muted-foreground line-through")}>{card.t}</p>
                  <div className="flex items-center gap-2">
                    <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold", card.c)}>{card.p}</span>
                    <span className="ml-auto h-5 w-5 rounded-full bg-primary/30" />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="absolute -right-2 top-16 hidden w-64 rounded-xl border bg-popover p-3 shadow-elevated sm:block lg:-right-10">
        <p className="flex items-center gap-2 text-xs font-semibold"><BellRing className="h-3.5 w-3.5 text-coral" /> Nova menção</p>
        <p className="mt-1 text-xs text-muted-foreground">“@Você, consegue revisar os wireframes até sexta?”</p>
      </div>
    </div>
  );
}

function ContactForm() {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "", website: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const send = useMutation({ mutationFn: () => apiRequest("/v1/contato", { method: "POST", body: form, skipRefresh: true }) });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const r = contactSchema.safeParse(form);
    if (!r.success) {
      setErrors(Object.fromEntries(r.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setErrors({});
    send.mutate();
  };
  if (send.isSuccess) {
    return (
      <div className="flex items-start gap-3 rounded-xl border bg-card p-6">
        <MailCheck className="h-6 w-6 text-success" aria-hidden />
        <div><p className="font-semibold">Mensagem enviada!</p><p className="text-sm text-muted-foreground">Responderemos no e-mail {form.email}.</p></div>
      </div>
    );
  }
  const field = (key: "name" | "email" | "subject", label: string, type = "text") => (
    <div className="space-y-1.5">
      <Label htmlFor={`ct-${key}`}>{label}</Label>
      <Input id={`ct-${key}`} type={type} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} aria-invalid={Boolean(errors[key])} />
      {errors[key] && <p className="text-xs text-destructive">{errors[key]}</p>}
    </div>
  );
  return (
    <form onSubmit={submit} noValidate className="space-y-4 rounded-2xl border bg-card p-6 shadow-card">
      <div className="grid gap-4 sm:grid-cols-2">{field("name", "Nome")}{field("email", "E-mail", "email")}</div>
      {field("subject", "Assunto")}
      <div className="space-y-1.5">
        <Label htmlFor="ct-message">Mensagem</Label>
        <Textarea id="ct-message" rows={5} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} aria-invalid={Boolean(errors.message)} />
        {errors.message && <p className="text-xs text-destructive">{errors.message}</p>}
      </div>
      {/* Campo-isca para robôs (invisível para pessoas). */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} aria-hidden />
      {send.isError && <InlineError>{getErrorMessage(send.error)}</InlineError>}
      <Button type="submit" disabled={send.isPending} className="bg-brand text-white hover:brightness-110">{send.isPending && <Loader2 className="animate-spin" />} Enviar mensagem</Button>
      <p className="text-xs text-muted-foreground">Usamos seus dados apenas para responder a este contato. Veja a <Link to="/privacidade" className="underline">política de privacidade</Link>.</p>
    </form>
  );
}

function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="divide-y rounded-2xl border bg-card">
      {FAQ.map((item, i) => (
        <div key={item.q}>
          <h3>
            <button className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-medium" aria-expanded={open === i} aria-controls={`faq-${i}`} onClick={() => setOpen(open === i ? null : i)}>
              {item.q}
              <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", open === i && "rotate-180")} aria-hidden />
            </button>
          </h3>
          <div id={`faq-${i}`} hidden={open !== i} className="px-5 pb-4 text-sm text-muted-foreground">{item.a}</div>
        </div>
      ))}
    </div>
  );
}

function Section({ id, eyebrow, title, text, children, className }: { id: string; eyebrow: string; title: string; text?: string; children: React.ReactNode; className?: string }) {
  return (
    <section id={id} className={cn("scroll-mt-20 px-4 py-20 sm:px-6", className)} aria-labelledby={`${id}-h`}>
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">{eyebrow}</p>
          <h2 id={`${id}-h`} className="mt-2 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h2>
          {text && <p className="mt-3 text-muted-foreground">{text}</p>}
        </div>
        {children}
      </div>
    </section>
  );
}

export default function LandingPage() {
  const { hash } = useLocation();
  useEffect(() => {
    document.title = "Andamo — Organize seu trabalho. Conecte sua equipe. Faça acontecer.";
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: "smooth" });
  }, [hash]);

  return (
    <PublicLayout>
      <section className="bg-brand-glow relative overflow-hidden px-4 pb-20 pt-16 sm:px-6 sm:pt-24">
        <div className="mx-auto max-w-4xl text-center">
          <p className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <Zap className="h-3.5 w-3.5 text-coral" aria-hidden /> Gestão de projetos, tarefas e equipes
          </p>
          <h1 className="font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
            Organize seu trabalho.
            <br />
            Conecte sua equipe.
            <br />
            <span className="text-gradient">Faça acontecer.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            O Andamo reúne projetos, tarefas, prazos e conversas num só lugar — com notificações que chegam na hora certa e um painel que mostra o que realmente importa.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="bg-brand text-white shadow-glow hover:brightness-110"><Link to="/cadastro">Começar grátis</Link></Button>
            <Button asChild size="lg" variant="outline"><Link to="/#precos">Ver planos</Link></Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Plano Free para sempre · sem cartão de crédito</p>
        </div>
        <div className="mt-16"><ProductDemo /></div>
      </section>

      <Section id="recursos" eyebrow="Recursos" title="Tudo o que seu time precisa para entregar" text="Do primeiro rascunho à entrega final, sem planilhas espalhadas nem mensagens perdidas.">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <article key={f.title} className="rounded-2xl border bg-card p-6 shadow-card transition-shadow hover:shadow-elevated">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><f.icon className="h-5 w-5" aria-hidden /></span>
              <h3 className="mt-4 font-display text-lg font-bold">{f.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{f.text}</p>
            </article>
          ))}
        </div>
      </Section>

      <Section id="beneficios" eyebrow="Benefícios" title="Menos caos, mais andamento" className="bg-card/40">
        <div className="grid gap-6 md:grid-cols-2">
          {BENEFITS.map((b) => (
            <div key={b.title} className="flex gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-coral/15 text-coral"><b.icon className="h-5 w-5" aria-hidden /></span>
              <div><h3 className="font-display text-lg font-bold">{b.title}</h3><p className="mt-1 text-sm text-muted-foreground">{b.text}</p></div>
            </div>
          ))}
        </div>
      </Section>

      <Section id="precos" eyebrow="Planos e preços" title="Comece grátis. Cresça quando quiser." text="Preços por workspace, por mês. Os planos pagos têm 14 dias de teste.">
        <PricingCards
          renderAction={(id) => (
            <Button asChild className="w-full" variant={id === "pro" ? "default" : "outline"}>
              <Link to={id === "free" ? "/cadastro" : "/#contato"}>{id === "free" ? "Criar conta grátis" : "Falar com a equipe"}</Link>
            </Button>
          )}
        />
        <p className="mt-4 text-center text-xs text-muted-foreground">A contratação online dos planos pagos será liberada em breve; até lá, fale com a equipe pelo formulário abaixo.</p>
        <h3 className="mb-4 mt-14 text-center font-display text-2xl font-bold">Compare os planos</h3>
        <PlanComparison />
      </Section>

      <Section id="faq" eyebrow="Perguntas frequentes" title="Ficou com alguma dúvida?" className="bg-card/40">
        <div className="mx-auto max-w-3xl"><Faq /></div>
      </Section>

      <Section id="contato" eyebrow="Contato" title="Fale com a gente" text="Dúvidas, sugestões ou interesse nos planos Pro e Business? Responderemos por e-mail.">
        <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[1fr_1.4fr]">
          <div className="space-y-4 text-sm">
            {[
              { icon: Lock, t: "Privacidade", d: "Seus dados de contato são usados apenas para responder." },
              { icon: CheckCircle2, t: "Resposta por e-mail", d: "Você recebe o retorno no endereço informado." },
            ].map((x) => (
              <div key={x.t} className="flex gap-3"><x.icon className="mt-0.5 h-5 w-5 text-primary" aria-hidden /><div><p className="font-semibold">{x.t}</p><p className="text-muted-foreground">{x.d}</p></div></div>
            ))}
          </div>
          <ContactForm />
        </div>
      </Section>

      <section className="px-4 pb-20 sm:px-6">
        <div className="mx-auto max-w-5xl rounded-3xl bg-brand px-6 py-14 text-center text-white shadow-glow">
          <h2 className="font-display text-3xl font-extrabold sm:text-4xl">Pronto para colocar tudo em andamento?</h2>
          <p className="mx-auto mt-3 max-w-xl text-white/85">Crie sua conta em menos de um minuto e convide sua equipe quando quiser.</p>
          <Button asChild size="lg" className="mt-8 bg-white text-primary hover:bg-white/90"><Link to="/cadastro">Começar grátis</Link></Button>
        </div>
      </section>
    </PublicLayout>
  );
}
