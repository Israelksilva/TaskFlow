/** Planos comerciais (configuráveis aqui). Valores em centavos de BRL, por workspace/mês. */
export const PLAN_IDS = ["free", "pro", "business"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export interface PlanLimits {
  /** `null` = ilimitado */
  members: number | null;
  projects: number | null;
  storageMb: number;
  automations: number | null;
}

export interface PlanFeatures {
  views: boolean;
  timeTracking: boolean;
  reports: boolean;
  automations: boolean;
  guests: boolean;
  prioritySupport: boolean;
  auditLog: boolean;
}

export interface Plan {
  id: PlanId;
  name: string;
  priceCents: number;
  tagline: string;
  highlights: string[];
  limits: PlanLimits;
  features: PlanFeatures;
  trialDays: number;
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Free",
    priceCents: 0,
    tagline: "Para organizar o seu trabalho e pequenos times.",
    highlights: ["Até 5 membros", "Até 3 projetos", "Kanban personalizável, lista e calendário", "Controle de tempo, relatórios e 3 automações"],
    limits: { members: 5, projects: 3, storageMb: 100, automations: 3 },
    features: {
      views: true,
      timeTracking: true,
      reports: true,
      automations: true,
      guests: false,
      prioritySupport: false,
      auditLog: false,
    },
    trialDays: 0,
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceCents: 2990,
    tagline: "Para equipes que precisam de ritmo e visibilidade.",
    highlights: ["Até 25 membros", "Projetos ilimitados", "Controle de tempo e relatórios", "10 automações"],
    limits: { members: 25, projects: null, storageMb: 5_000, automations: 10 },
    features: {
      views: true,
      timeTracking: true,
      reports: true,
      automations: true,
      guests: true,
      prioritySupport: false,
      auditLog: false,
    },
    trialDays: 14,
  },
  business: {
    id: "business",
    name: "Business",
    priceCents: 7990,
    tagline: "Para organizações com várias equipes e governança.",
    highlights: ["Membros ilimitados", "Automações ilimitadas", "50 GB de armazenamento", "Auditoria e suporte prioritário"],
    limits: { members: null, projects: null, storageMb: 50_000, automations: null },
    features: {
      views: true,
      timeTracking: true,
      reports: true,
      automations: true,
      guests: true,
      prioritySupport: true,
      auditLog: true,
    },
    trialDays: 14,
  },
};

export function formatPrice(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
