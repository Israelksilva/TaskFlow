import { Link } from "react-router-dom";
import { useState } from "react";
import { Info } from "lucide-react";
import { can, PLANS } from "@andamo/shared";
import { useCrumbs } from "@/components/layout/AppHeader";
import { Button } from "@/components/ui/button";
import { useCurrentWorkspace, useMembers, useProjects } from "@/features/workspaces/hooks";
import { PlanComparison, PricingCards } from "./PricingTable";
import { useBilling } from "./hooks";
import { CheckoutDialog, SubscriptionSection } from "./SubscriptionSection";

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
  const isOwner = can(ws.role, "workspace.billing");
  const billing = useBilling(ws.id, isOwner);
  const [checkoutPlan, setCheckoutPlan] = useState<"pro" | "business" | null>(null);
  const sub = billing.data?.subscription;
  const hasActive = sub && sub.status !== "cancelled";
  const canCheckout = isOwner && billing.data?.available && !hasActive;
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

      {isOwner && billing.data && <SubscriptionSection ws={ws.id} info={billing.data} />}
      {!isOwner && (
        <div className="flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
          <p>Somente o proprietário do workspace gerencia a assinatura.</p>
        </div>
      )}

      <PricingCards
        current={ws.plan}
        renderAction={(id) =>
          id === ws.plan ? (
            <Button variant="outline" className="w-full" disabled>Plano atual</Button>
          ) : canCheckout && id !== "free" ? (
            <Button variant={id === "pro" ? "default" : "outline"} className="w-full" onClick={() => setCheckoutPlan(id)}>
              Assinar o {PLANS[id].name} (teste)
            </Button>
          ) : id === "free" && hasActive ? (
            <Button variant="outline" className="w-full" disabled>Cancele a assinatura para voltar ao Free</Button>
          ) : (
            <Button asChild variant={id === "pro" ? "default" : "outline"} className="w-full">
              <Link to="/#contato">Falar sobre o {PLANS[id].name}</Link>
            </Button>
          )
        }
      />
      <PlanComparison />
      <CheckoutDialog ws={ws.id} plan={checkoutPlan} onClose={() => setCheckoutPlan(null)} />
    </div>
  );
}
