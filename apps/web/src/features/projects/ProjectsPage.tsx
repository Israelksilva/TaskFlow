import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, FolderKanban, LayoutTemplate, Plus } from "lucide-react";
import { can, formatPrice, PLANS, PROJECT_STATUS_LABELS, type Project } from "@andamo/shared";
import { EmptyState } from "@/components/feedback/EmptyState";
import { InlineError } from "@/components/feedback/InlineError";
import { useCrumbs } from "@/components/layout/AppHeader";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCurrentWorkspace, useProjects } from "@/features/workspaces/hooks";
import { getErrorMessage } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import { ProjectFormDialog } from "./components/ProjectFormDialog";

function ProjectCard({ p, base }: { p: Project; base: string }) {
  return (
    <Link
      to={`${base}/projetos/${p.id}`}
      className="group flex flex-col rounded-xl border bg-card p-5 shadow-card transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-elevated"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-bold text-white" style={{ background: p.color }} aria-hidden>
          {p.name[0]?.toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-display font-bold group-hover:text-primary">{p.name}</h2>
          <p className="text-xs text-muted-foreground">
            {PROJECT_STATUS_LABELS[p.status]}
            {p.dueDate && ` · até ${formatDate(p.dueDate)}`}
          </p>
        </div>
      </div>
      {(p.goal || p.description) && <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{p.goal ?? p.description}</p>}
      <div className="mt-auto pt-4">
        <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {p.doneCount}/{p.taskCount} tarefas
          </span>
          {p.overdueCount > 0 && (
            <span className="flex items-center gap-1 font-medium text-destructive">
              <AlertTriangle className="h-3 w-3" aria-hidden /> {p.overdueCount} atrasada(s)
            </span>
          )}
          <span className="font-semibold text-foreground">{p.progress}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${p.progress}%`, background: p.color }} />
        </div>
      </div>
    </Link>
  );
}

export default function ProjectsPage() {
  const ws = useCurrentWorkspace();
  const [view, setView] = useState<"active" | "archived" | "templates">("active");
  const [creating, setCreating] = useState(false);
  const projects = useProjects(ws.id, view);
  const base = `/app/w/${ws.id}`;
  const limit = PLANS[ws.plan].limits.projects;
  const activeCount = useProjects(ws.id, "active").data?.length ?? 0;
  useCrumbs([{ label: ws.name, to: base }, { label: "Projetos" }]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">Projetos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {limit === null ? "Projetos ilimitados no seu plano." : `${activeCount} de ${limit} projetos ativos no plano ${PLANS[ws.plan].name}.`}
            {limit !== null && activeCount >= limit && (
              <>
                {" "}
                <Link to={`${base}/planos`} className="font-medium text-primary hover:underline">
                  Pro por {formatPrice(PLANS.pro.priceCents)}/mês libera projetos ilimitados.
                </Link>
              </>
            )}
          </p>
        </div>
        {can(ws.role, "projects.create") && (
          <Button onClick={() => setCreating(true)} className="bg-brand text-white shadow-glow hover:brightness-110">
            <Plus /> Novo projeto
          </Button>
        )}
      </div>

      <Tabs value={view} onValueChange={(v) => setView(v as typeof view)}>
        <TabsList>
          <TabsTrigger value="active">Ativos</TabsTrigger>
          <TabsTrigger value="templates">
            <LayoutTemplate /> Templates
          </TabsTrigger>
          <TabsTrigger value="archived">Arquivados</TabsTrigger>
        </TabsList>
      </Tabs>

      {projects.isError && <InlineError>{getErrorMessage(projects.error)}</InlineError>}
      {projects.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-44 rounded-xl" />
          ))}
        </div>
      ) : projects.data?.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {projects.data.map((p) => (
            <ProjectCard key={p.id} p={p} base={base} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={view === "templates" ? LayoutTemplate : FolderKanban}
          title={view === "templates" ? "Nenhum template ainda" : view === "archived" ? "Nenhum projeto arquivado" : "Nenhum projeto"}
          description={view === "templates" ? "Marque um projeto como template para reutilizar sua estrutura de tarefas." : "Projetos organizam tarefas, prazos e pessoas em torno de um objetivo."}
          action={view === "active" && can(ws.role, "projects.create") ? <Button onClick={() => setCreating(true)}><Plus /> Criar projeto</Button> : undefined}
        />
      )}
      <ProjectFormDialog open={creating} onOpenChange={setCreating} workspace={ws} />
    </div>
  );
}
