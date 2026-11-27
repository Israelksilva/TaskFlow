import type { ReactNode } from "react";
import { Check, Minus } from "lucide-react";
import { formatPrice, PLAN_IDS, PLANS, type PlanId } from "@andamo/shared";
import { cn } from "@/lib/utils";

/** Cartões de planos, gerados a partir da configuração única em @andamo/shared. */
export function PricingCards({ current, renderAction }: { current?: PlanId; renderAction: (plan: PlanId) => ReactNode }) {
  return (
    <div className="grid gap-5 md:grid-cols-3">
      {PLAN_IDS.map((id) => {
        const plan = PLANS[id];
        const featured = id === "pro";
        return (
          <article
            key={id}
            className={cn(
              "relative flex flex-col rounded-2xl border bg-card p-6 shadow-card",
              featured && "border-primary/50 shadow-elevated ring-1 ring-primary/30",
              current === id && "ring-2 ring-primary",
            )}
          >
            {featured && <span className="absolute -top-3 left-6 rounded-full bg-brand px-3 py-1 text-xs font-semibold text-white">Mais escolhido</span>}
            <h3 className="font-display text-xl font-bold">{plan.name}</h3>
            <p className="mt-1 min-h-10 text-sm text-muted-foreground">{plan.tagline}</p>
            <p className="mt-4">
              <span className="font-display text-4xl font-extrabold tracking-tight">{formatPrice(plan.priceCents)}</span>
              <span className="text-sm text-muted-foreground">/mês por workspace</span>
            </p>
            {plan.trialDays > 0 && <p className="mt-1 text-xs font-medium text-primary">{plan.trialDays} dias de teste grátis</p>}
            <ul className="mt-5 space-y-2 text-sm">
              {plan.highlights.map((h) => (
                <li key={h} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden /> {h}
                </li>
              ))}
            </ul>
            <div className="mt-6 pt-2 md:mt-auto">{renderAction(id)}</div>
          </article>
        );
      })}
    </div>
  );
}

const ROWS: Array<{ label: string; value: (id: PlanId) => string | boolean }> = [
  { label: "Membros", value: (id) => (PLANS[id].limits.members === null ? "Ilimitados" : `Até ${PLANS[id].limits.members}`) },
  { label: "Projetos ativos", value: (id) => (PLANS[id].limits.projects === null ? "Ilimitados" : `Até ${PLANS[id].limits.projects}`) },
  { label: "Armazenamento", value: (id) => `${PLANS[id].limits.storageMb >= 1000 ? `${PLANS[id].limits.storageMb / 1000} GB` : `${PLANS[id].limits.storageMb} MB`}` },
  { label: "Kanban, lista, tabela, timeline e calendário", value: (id) => PLANS[id].features.views },
  { label: "Notificações, lembretes, push e e-mail", value: () => true },
  { label: "Convidados e visualizadores", value: (id) => PLANS[id].features.guests },
  { label: "Controle de tempo", value: (id) => PLANS[id].features.timeTracking },
  { label: "Relatórios", value: (id) => PLANS[id].features.reports },
  { label: "Automações", value: (id) => (PLANS[id].limits.automations === null ? "Ilimitadas" : PLANS[id].limits.automations ? `Até ${PLANS[id].limits.automations}` : false) },
  { label: "Auditoria administrativa", value: (id) => PLANS[id].features.auditLog },
  { label: "Suporte prioritário", value: (id) => PLANS[id].features.prioritySupport },
];

export function PlanComparison() {
  return (
    <div className="overflow-x-auto rounded-2xl border bg-card shadow-card">
      <table className="w-full min-w-[560px] text-sm">
        <caption className="sr-only">Comparação de planos</caption>
        <thead>
          <tr className="border-b text-left">
            <th scope="col" className="px-5 py-3 font-medium text-muted-foreground">Recurso</th>
            {PLAN_IDS.map((id) => (
              <th key={id} scope="col" className="px-5 py-3 text-center font-display font-bold">{PLANS[id].name}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {ROWS.map((row) => (
            <tr key={row.label}>
              <th scope="row" className="px-5 py-3 text-left font-normal">{row.label}</th>
              {PLAN_IDS.map((id) => {
                const v = row.value(id);
                return (
                  <td key={id} className="px-5 py-3 text-center">
                    {v === true ? <Check className="mx-auto h-4 w-4 text-success" aria-label="Incluído" /> : v === false ? <Minus className="mx-auto h-4 w-4 text-muted-foreground" aria-label="Não incluído" /> : v}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
