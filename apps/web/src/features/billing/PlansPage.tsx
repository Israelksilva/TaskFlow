import { Link } from "react-router-dom";
import { Info } from "lucide-react";
import { PLANS } from "@andamo/shared";
import { useCrumbs } from "@/components/layout/AppHeader";
import { Button } from "@/components/ui/button";
import { useCurrentWorkspace, useMembers, useProjects } from "@/features/workspaces/hooks";
import { PlanComparison, PricingCards } from "./PricingTable";

function Usage({ label, used, limit }: { label: string; used: number; limit: number | null }) {
  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span>{label}</span>
        <span className="tabular-nums text-muted-foreground">{limit === null ? `${used} · ilimitado` : `${used} de ${limit}`}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className={pct >= 90 ? "h-full bg-destructive" : "h-full bg-brand"} style={{ width: limit === null ? "100%" : `${pct}%`, opacity: limit === null ? 0.3 : 1 }} />
      </div>
    </div>
  );
}

export default function PlansPage() {
  const ws = useCurrentWorkspace();
  const members = useMembers(ws.id).data ?? [];
  const projects = useProjects(ws.id).data ?? [];
  const plan = PLANS[ws.plan];
  useCrumbs([{ label: ws.name, to: `/app/w/${ws.id}` }, { label: "Planos e assinatura" }]);

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-6 sm:px-6 lg:py-8">
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Planos e assinatura</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {ws.name} está no plano <strong className="text-foreground">{plan.name}</strong>.
        </p>
      </div>

      <section className="grid gap-4 rounded-xl border bg-card p-5 shadow-card sm:grid-cols-2">
        <Usage label="Membros" used={members.length} limit={plan.limits.members} />
        <Usage label="Projetos ativos" used={projects.filter((p) => !p.isTemplate).length} limit={plan.limits.projects} />
      </section>

      <div className="flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
        <p>
          O pagamento online ainda não está habilitado: a integração com o provedor (Stripe ou Mercado Pago) será ativada em ambiente de testes antes de qualquer cobrança real.
          Para mudar de plano agora, <Link to="/#contato" className="font-medium text-primary hover:underline">fale com a equipe do Andamo</Link>.
        </p>
      </div>

      <PricingCards
        current={ws.plan}
        renderAction={(id) =>
          id === ws.plan ? (
            <Button variant="outline" className="w-full" disabled>Plano atual</Button>
          ) : (
            <Button asChild variant={id === "pro" ? "default" : "outline"} className="w-full">
              <Link to="/#contato">Falar sobre o {PLANS[id].name}</Link>
            </Button>
          )
        }
      />
      <PlanComparison />
    </div>
  );
}
