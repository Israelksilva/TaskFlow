import { useState, type ReactNode } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, Ban, CheckCircle2, Loader2, Megaphone, Search, ShieldAlert, Undo2 } from "lucide-react";
import { toast } from "sonner";
import {
  PLAN_IDS,
  PLANS,
  TICKET_PRIORITIES,
  TICKET_PRIORITY_LABELS,
  TICKET_STATUS_LABELS,
  TICKET_STATUSES,
  TICKET_TYPE_LABELS,
  type AdminUser,
  type AdminWorkspace,
  type PlanId,
  type TicketPriority,
  type TicketStatus,
} from "@andamo/shared";
import { EmptyState } from "@/components/feedback/EmptyState";
import { InlineError } from "@/components/feedback/InlineError";
import { useCrumbs } from "@/components/layout/AppHeader";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/features/auth/use-auth";
import { ApiError, getErrorMessage } from "@/lib/api-client";
import { formatDateTime, relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { adminApi } from "../support/api";
import { TicketStatusBadge, TicketThreadView } from "../support/components/TicketThreadView";

const SECTIONS = [
  { id: "", label: "Visão geral" },
  { id: "usuarios", label: "Usuários" },
  { id: "workspaces", label: "Workspaces e planos" },
  { id: "suporte", label: "Chamados" },
  { id: "avisos", label: "Avisos" },
  { id: "contatos", label: "Contatos" },
  { id: "auditoria", label: "Auditoria" },
  { id: "status", label: "Status" },
] as const;

const brl = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const Card = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cn("rounded-xl border bg-card p-4 shadow-card", className)}>{children}</div>
);
const Stat = ({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) => (
  <Card>
    <p className="text-xs font-medium text-muted-foreground">{label}</p>
    <p className="mt-1 font-display text-2xl font-extrabold tabular-nums">{value}</p>
    {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
  </Card>
);
const Loading = () => <Skeleton className="h-48 rounded-xl" />;

/** Confirmação com motivo obrigatório (vai para a auditoria). */
function ReasonDialog({
  open, title, description, confirmLabel, destructive, onConfirm, onClose, children,
}: {
  open: boolean; title: string; description: string; confirmLabel: string; destructive?: boolean;
  onConfirm: (reason: string) => Promise<unknown>; onClose: () => void; children?: ReactNode;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && (setReason(""), onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
        <div className="space-y-1.5">
          <Label htmlFor="adm-reason">Motivo (fica registrado na auditoria)</Label>
          <Input id="adm-reason" value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} autoFocus />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            disabled={reason.trim().length < 3 || busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm(reason.trim());
                setReason("");
                onClose();
              } catch (e) {
                toast.error(getErrorMessage(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy && <Loader2 className="animate-spin" />} {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------- visão geral
function Overview() {
  const q = useQuery({ queryKey: ["admin", "overview"], queryFn: adminApi.overview });
  if (q.isPending) return <Loading />;
  if (q.isError) return <InlineError>{getErrorMessage(q.error)}</InlineError>;
  const o = q.data;
  const max = Math.max(1, ...o.signups.map((s) => s.count));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Usuários" value={o.users.total} hint={`${o.users.suspended} suspenso(s)`} />
        <Stat label="Ativos (30 dias)" value={o.users.active30d} hint="fizeram login no período" />
        <Stat label="Novos cadastros" value={o.users.new30d} hint={`${o.users.new7d} nos últimos 7 dias`} />
        <Stat label="Workspaces" value={o.workspaces.total} hint={`${o.workspaces.team} de equipe`} />
        <Stat label="Assinaturas pagas" value={o.subscriptions} hint="planos atribuídos" />
        <Stat label="Receita mensal estimada" value={brl(o.mrrCents)} hint="pelos planos atribuídos" />
        <Stat label="Conversão" value={`${o.conversionRate}%`} hint="equipes em plano pago" />
        <Stat label="Cancelamentos (30 dias)" value={o.cancellations30d} hint="pago → Free" />
      </div>
      <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
        Ainda não há cobrança online: receita e assinaturas refletem planos atribuídos manualmente pela administração.
      </p>
      <div className="grid gap-3 lg:grid-cols-[2fr_1fr]">
        <Card>
          <p className="mb-3 text-sm font-semibold">Cadastros nos últimos 30 dias</p>
          <div className="flex h-32 items-end gap-1" role="img" aria-label="Gráfico de cadastros por dia">
            {o.signups.map((s) => (
              <div key={s.date} className="group relative flex-1">
                <div className="rounded-t bg-primary/70 transition-colors group-hover:bg-primary" style={{ height: `${Math.max(2, (s.count / max) * 120)}px` }} />
                <span className="pointer-events-none absolute -top-7 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-foreground px-1.5 py-0.5 text-[10px] text-background group-hover:block">
                  {s.date.split("-").reverse().slice(0, 2).join("/")}: {s.count}
                </span>
              </div>
            ))}
          </div>
        </Card>
        <Card className="space-y-2">
          <p className="text-sm font-semibold">Workspaces por plano</p>
          {PLAN_IDS.map((p) => (
            <div key={p} className="flex items-center justify-between text-sm">
              <span>{PLANS[p].name}</span>
              <span className="font-semibold tabular-nums">{o.workspaces.byPlan[p] ?? 0}</span>
            </div>
          ))}
          <div className="border-t pt-2 text-sm">
            <Link to="/app/admin/suporte" className="font-medium text-primary hover:underline">
              {o.support.open} chamado(s) aguardando a equipe
            </Link>
            <p className="text-xs text-muted-foreground">{o.support.waiting} aguardando o cliente</p>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- usuários
function Users() {
  const qc = useQueryClient();
  const me = useAuth().user;
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [cursor, setCursor] = useState<string | undefined>();
  const [target, setTarget] = useState<AdminUser | null>(null);
  const q = useQuery({ queryKey: ["admin", "users", search, status, cursor], queryFn: () => adminApi.users({ q: search || undefined, status, cursor }), placeholderData: keepPreviousData });
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input className="pl-9" placeholder="Buscar por nome ou e-mail" value={search} onChange={(e) => (setSearch(e.target.value), setCursor(undefined))} aria-label="Buscar usuários" />
        </div>
        <Select value={status} onValueChange={(v) => (setStatus(v), setCursor(undefined))}>
          <SelectTrigger className="w-40" aria-label="Situação"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Ativos</SelectItem>
            <SelectItem value="suspended">Suspensos</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {q.isError && <InlineError>{getErrorMessage(q.error)}</InlineError>}
      {q.isPending ? <Loading /> : !q.data?.items.length ? (
        <EmptyState icon={Search} title="Nenhum usuário encontrado" description="Ajuste a busca ou o filtro." />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-card">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b text-left text-xs text-muted-foreground">
              <tr><th className="p-3">Usuário</th><th className="p-3">Cadastro</th><th className="p-3">Último acesso</th><th className="p-3">Segurança</th><th className="p-3">Workspaces</th><th className="p-3" /></tr>
            </thead>
            <tbody className="divide-y">
              {q.data.items.map((u) => (
                <tr key={u.id} className={cn(u.suspendedAt && "bg-destructive/5")}>
                  <td className="p-3">
                    <p className="font-medium">{u.name} {u.isPlatformAdmin && <span className="ml-1 rounded bg-brand/15 px-1.5 text-[10px] font-semibold text-brand">ADMIN</span>}</p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </td>
                  <td className="p-3 text-xs">{formatDateTime(u.createdAt)}</td>
                  <td className="p-3 text-xs">{u.lastLoginAt ? relativeTime(u.lastLoginAt) : "nunca"}</td>
                  <td className="p-3 text-xs">{u.emailVerified ? "e-mail verificado" : "e-mail não verificado"}{u.twoFactorEnabled && " · 2FA"}</td>
                  <td className="p-3 tabular-nums">{u.workspaceCount}</td>
                  <td className="p-3 text-right">
                    {u.id !== me?.id && !u.isPlatformAdmin && (
                      <Button size="sm" variant={u.suspendedAt ? "outline" : "ghost"} onClick={() => setTarget(u)}>
                        {u.suspendedAt ? <><Undo2 /> Reativar</> : <><Ban /> Suspender</>}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex justify-end gap-2">
        {cursor && <Button variant="ghost" size="sm" onClick={() => setCursor(undefined)}>Voltar ao início</Button>}
        {q.data?.nextCursor && <Button variant="outline" size="sm" onClick={() => setCursor(q.data.nextCursor!)}>Próxima página</Button>}
      </div>
      <ReasonDialog
        open={Boolean(target)}
        onClose={() => setTarget(null)}
        destructive={!target?.suspendedAt}
        title={target?.suspendedAt ? `Reativar ${target?.name}?` : `Suspender ${target?.name}?`}
        description={target?.suspendedAt ? "A pessoa volta a conseguir entrar normalmente." : "Todas as sessões são encerradas e o login fica bloqueado. Nenhum dado é apagado e dá para reativar depois."}
        confirmLabel={target?.suspendedAt ? "Reativar conta" : "Suspender conta"}
        onConfirm={async (reason) => {
          await adminApi.suspend(target!.id, !target!.suspendedAt, reason);
          toast.success(target!.suspendedAt ? "Conta reativada" : "Conta suspensa");
          void qc.invalidateQueries({ queryKey: ["admin"] });
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------- workspaces
function Workspaces() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [plan, setPlan] = useState("all");
  const [target, setTarget] = useState<AdminWorkspace | null>(null);
  const [newPlan, setNewPlan] = useState<PlanId>("pro");
  const q = useQuery({ queryKey: ["admin", "workspaces", search, plan], queryFn: () => adminApi.workspaces({ q: search || undefined, plan: plan === "all" ? undefined : plan }), placeholderData: keepPreviousData });
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input className="pl-9" placeholder="Buscar por nome ou e-mail do dono" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Buscar workspaces" />
        </div>
        <Select value={plan} onValueChange={setPlan}>
          <SelectTrigger className="w-40" aria-label="Plano"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os planos</SelectItem>
            {PLAN_IDS.map((p) => <SelectItem key={p} value={p}>{PLANS[p].name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {q.isError && <InlineError>{getErrorMessage(q.error)}</InlineError>}
      {q.isPending ? <Loading /> : (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-card">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b text-left text-xs text-muted-foreground">
              <tr><th className="p-3">Workspace</th><th className="p-3">Dono</th><th className="p-3">Membros</th><th className="p-3">Projetos</th><th className="p-3">Plano</th><th className="p-3" /></tr>
            </thead>
            <tbody className="divide-y">
              {(q.data ?? []).map((w) => (
                <tr key={w.id}>
                  <td className="p-3">
                    <p className="font-medium">{w.name}</p>
                    <p className="text-xs text-muted-foreground">{w.isPersonal ? "Pessoal" : "Equipe"} · criado em {formatDateTime(w.createdAt)}{w.archivedAt && " · arquivado"}</p>
                  </td>
                  <td className="p-3 text-xs">{w.owner ? <>{w.owner.name}<br /><span className="text-muted-foreground">{w.owner.email}</span></> : "—"}</td>
                  <td className="p-3 tabular-nums">{w.memberCount}</td>
                  <td className="p-3 tabular-nums">{w.projectCount}</td>
                  <td className="p-3"><span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", w.plan === "free" ? "bg-muted" : "bg-primary/10 text-primary")}>{PLANS[w.plan].name}</span></td>
                  <td className="p-3 text-right">
                    {!w.isPersonal && <Button size="sm" variant="ghost" onClick={() => (setTarget(w), setNewPlan(w.plan === "free" ? "pro" : "free"))}>Alterar plano</Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ReasonDialog
        open={Boolean(target)}
        onClose={() => setTarget(null)}
        title={`Plano de ${target?.name ?? ""}`}
        description="Atribuição manual (não gera cobrança). O dono do workspace é avisado."
        confirmLabel="Aplicar plano"
        onConfirm={async (reason) => {
          await adminApi.setPlan(target!.id, newPlan, reason);
          toast.success(`Plano ${PLANS[newPlan].name} aplicado`);
          void qc.invalidateQueries({ queryKey: ["admin"] });
        }}
      >
        <div className="space-y-1.5">
          <Label>Novo plano</Label>
          <Select value={newPlan} onValueChange={(v) => setNewPlan(v as PlanId)}>
            <SelectTrigger aria-label="Novo plano"><SelectValue /></SelectTrigger>
            <SelectContent>{PLAN_IDS.map((p) => <SelectItem key={p} value={p} disabled={p === target?.plan}>{PLANS[p].name} — {brl(PLANS[p].priceCents)}/mês</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </ReasonDialog>
    </div>
  );
}

// ---------------------------------------------------------------- chamados
function Tickets() {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const openId = params.get("chamado");
  const [status, setStatus] = useState<TicketStatus | "active" | "all">("active");
  const list = useQuery({ queryKey: ["admin", "tickets", status], queryFn: () => adminApi.tickets({ status: status === "all" ? undefined : status }) });
  const thread = useQuery({ queryKey: ["admin", "ticket", openId], queryFn: () => adminApi.ticket(openId!), enabled: Boolean(openId) });
  const onThread = (data: Awaited<ReturnType<typeof adminApi.ticket>>) => {
    qc.setQueryData(["admin", "ticket", openId], data);
    void qc.invalidateQueries({ queryKey: ["admin", "tickets"] });
  };
  const reply = useMutation({ mutationFn: (m: string) => adminApi.replyTicket(openId!, m), onSuccess: onThread, onError: (e) => toast.error(getErrorMessage(e)) });
  const update = useMutation({ mutationFn: (d: { status?: TicketStatus; priority?: TicketPriority }) => adminApi.updateTicket(openId!, d), onSuccess: onThread, onError: (e) => toast.error(getErrorMessage(e)) });
  const open = (id: string | null) => setParams((p) => (id ? p.set("chamado", id) : p.delete("chamado"), p));
  return (
    <div className="space-y-3">
      <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
        <SelectTrigger className="w-52" aria-label="Status"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="active">Em andamento</SelectItem>
          {TICKET_STATUSES.map((s) => <SelectItem key={s} value={s}>{TICKET_STATUS_LABELS[s]}</SelectItem>)}
          <SelectItem value="all">Todos</SelectItem>
        </SelectContent>
      </Select>
      {list.isError && <InlineError>{getErrorMessage(list.error)}</InlineError>}
      {list.isPending ? <Loading /> : !list.data?.length ? (
        <EmptyState icon={CheckCircle2} title="Nenhum chamado aqui" description="Tudo em dia." />
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-card">
          {list.data.map((t) => (
            <li key={t.id}>
              <button onClick={() => open(t.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-accent/40">
                {t.priority === "high" && <ShieldAlert className="h-4 w-4 shrink-0 text-destructive" aria-label="Prioridade alta" />}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{t.subject}</p>
                  <p className="text-xs text-muted-foreground">{TICKET_TYPE_LABELS[t.type]} · {t.requester?.name ?? "Conta removida"} · {relativeTime(t.lastMessageAt)} · {t.messageCount} msg</p>
                </div>
                <TicketStatusBadge status={t.status} viewer="staff" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Sheet open={Boolean(openId)} onOpenChange={(o) => !o && open(null)}>
        <SheetContent aria-describedby={undefined} className="sm:max-w-xl">
          <SheetTitle className="sr-only">Chamado</SheetTitle>
          {thread.isPending ? <Skeleton className="m-6 h-40" /> : thread.isError ? <div className="p-6"><InlineError>{getErrorMessage(thread.error)}</InlineError></div> : (
            <TicketThreadView
              thread={thread.data}
              viewer="staff"
              replying={reply.isPending}
              onReply={(m) => reply.mutateAsync(m)}
              actions={
                <div className="flex flex-wrap gap-2">
                  <Select value={thread.data.ticket.status} onValueChange={(v) => update.mutate({ status: v as TicketStatus })}>
                    <SelectTrigger className="h-8 w-44" aria-label="Alterar status"><SelectValue /></SelectTrigger>
                    <SelectContent>{TICKET_STATUSES.map((s) => <SelectItem key={s} value={s}>{s === "waiting_user" ? "Aguardando cliente" : TICKET_STATUS_LABELS[s]}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={thread.data.ticket.priority} onValueChange={(v) => update.mutate({ priority: v as TicketPriority })}>
                    <SelectTrigger className="h-8 w-36" aria-label="Alterar prioridade"><SelectValue /></SelectTrigger>
                    <SelectContent>{TICKET_PRIORITIES.map((p) => <SelectItem key={p} value={p}>Prioridade {TICKET_PRIORITY_LABELS[p].toLowerCase()}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              }
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ---------------------------------------------------------------- avisos
function Announcements() {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [level, setLevel] = useState<"info" | "warning" | "critical">("info");
  const [endsAt, setEndsAt] = useState("");
  const [notify, setNotify] = useState(false);
  const list = useQuery({ queryKey: ["admin", "announcements"], queryFn: adminApi.announcements });
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["admin", "announcements"] });
    void qc.invalidateQueries({ queryKey: ["announcements"] });
  };
  const create = useMutation({
    mutationFn: () => adminApi.createAnnouncement({ title, body, level, notify, endsAt: endsAt ? new Date(endsAt).toISOString() : null }),
    onSuccess: () => {
      toast.success(notify ? "Aviso publicado e notificações enviadas para a fila" : "Aviso publicado");
      setTitle(""); setBody(""); setEndsAt(""); setNotify(false);
      invalidate();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
  const end = useMutation({ mutationFn: adminApi.endAnnouncement, onSuccess: invalidate, onError: (e) => toast.error(getErrorMessage(e)) });
  const now = Date.now();
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="space-y-3">
        <p className="font-semibold">Novo aviso</p>
        <p className="text-xs text-muted-foreground">Aparece no topo do app para todos os usuários enquanto estiver ativo.</p>
        <div className="space-y-1.5"><Label htmlFor="an-title">Título</Label><Input id="an-title" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} /></div>
        <div className="space-y-1.5"><Label htmlFor="an-body">Detalhes</Label><Textarea id="an-body" rows={3} value={body} maxLength={1000} onChange={(e) => setBody(e.target.value)} /></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <Select value={level} onValueChange={(v) => setLevel(v as typeof level)}>
              <SelectTrigger aria-label="Tipo de aviso"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="info">Informação</SelectItem><SelectItem value="warning">Atenção</SelectItem><SelectItem value="critical">Crítico (não pode ser dispensado)</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label htmlFor="an-end">Encerrar em (opcional)</Label><Input id="an-end" type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} /></div>
        </div>
        <label className="flex items-center gap-2 text-sm"><Switch checked={notify} onCheckedChange={setNotify} /> Também notificar todos os usuários (central, push e e-mail conforme preferências)</label>
        <Button disabled={title.trim().length < 3 || create.isPending} onClick={() => create.mutate()}>
          {create.isPending ? <Loader2 className="animate-spin" /> : <Megaphone />} Publicar aviso
        </Button>
      </Card>
      <div className="space-y-2">
        {list.isPending ? <Loading /> : !list.data?.length ? <EmptyState icon={Megaphone} title="Nenhum aviso publicado" description="Use avisos para manutenções e novidades." /> : list.data.map((a) => {
          const active = Date.parse(a.startsAt) <= now && (!a.endsAt || Date.parse(a.endsAt) > now);
          return (
            <Card key={a.id} className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{a.title}</p>
                {a.body && <p className="text-sm text-muted-foreground">{a.body}</p>}
                <p className="mt-1 text-xs text-muted-foreground">{active ? "Ativo" : "Encerrado"} · {formatDateTime(a.startsAt)}{a.endsAt && ` → ${formatDateTime(a.endsAt)}`}</p>
              </div>
              {active && <Button size="sm" variant="outline" disabled={end.isPending} onClick={() => end.mutate(a.id)}>Encerrar</Button>}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- contatos
function Contacts() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin", "contacts"], queryFn: adminApi.contacts });
  const toggle = useMutation({
    mutationFn: ({ id, handled }: { id: string; handled: boolean }) => adminApi.setContactHandled(id, handled),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["admin", "contacts"] }),
    onError: (e) => toast.error(getErrorMessage(e)),
  });
  if (q.isPending) return <Loading />;
  if (q.isError) return <InlineError>{getErrorMessage(q.error)}</InlineError>;
  if (!q.data.length) return <EmptyState icon={CheckCircle2} title="Nenhuma mensagem" description="As mensagens do formulário de contato da página inicial aparecem aqui." />;
  return (
    <div className="space-y-2">
      {q.data.map((m) => (
        <Card key={m.id} className={cn("flex items-start gap-3", m.handledAt && "opacity-60")}>
          <div className="min-w-0 flex-1">
            <p className="font-medium">{m.subject}</p>
            <p className="text-xs text-muted-foreground">{m.name} · <a className="text-primary hover:underline" href={`mailto:${m.email}`}>{m.email}</a> · {formatDateTime(m.createdAt)}</p>
            <p className="mt-1 whitespace-pre-wrap text-sm">{m.message}</p>
          </div>
          <Button size="sm" variant="outline" disabled={toggle.isPending} onClick={() => toggle.mutate({ id: m.id, handled: !m.handledAt })}>
            {m.handledAt ? "Reabrir" : "Marcar como atendida"}
          </Button>
        </Card>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- auditoria
const ACTION_LABELS: Record<string, string> = {
  "admin.plan_changed": "Plano alterado",
  "admin.user_suspended": "Conta suspensa",
  "admin.user_reactivated": "Conta reativada",
  "admin.announcement_created": "Aviso publicado",
  "admin.announcement_ended": "Aviso encerrado",
  "admin.support_reply": "Resposta a chamado",
  "admin.support_update": "Chamado atualizado",
  "admin.contact_handled": "Contato atendido",
  "admin.granted_cli": "Acesso admin concedido (CLI)",
  "admin.revoked_cli": "Acesso admin removido (CLI)",
  "auth.login": "Login",
  "auth.login_mfa": "Login com 2FA",
  "auth.login_google": "Login com Google",
  "auth.password_reset": "Senha redefinida",
  "auth.mfa_enabled": "2FA ativado",
  "auth.mfa_disabled": "2FA desativado",
  "auth.password_changed": "Senha alterada",
  "auth.account_deleted": "Conta excluída",
};

function Audit() {
  const [filter, setFilter] = useState("");
  const [cursor, setCursor] = useState<string | undefined>();
  const q = useQuery({ queryKey: ["admin", "audit", filter, cursor], queryFn: () => adminApi.audit({ action: filter || undefined, cursor }), placeholderData: keepPreviousData });
  return (
    <div className="space-y-3">
      <Select value={filter || "all"} onValueChange={(v) => (setFilter(v === "all" ? "" : v), setCursor(undefined))}>
        <SelectTrigger className="w-60" aria-label="Filtrar ações"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas as ações</SelectItem>
          <SelectItem value="admin.">Ações administrativas</SelectItem>
          <SelectItem value="auth.">Autenticação</SelectItem>
          <SelectItem value="member.">Membros</SelectItem>
          <SelectItem value="workspace.">Workspaces</SelectItem>
        </SelectContent>
      </Select>
      {q.isError && <InlineError>{getErrorMessage(q.error)}</InlineError>}
      {q.isPending ? <Loading /> : (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-card">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b text-left text-xs text-muted-foreground"><tr><th className="p-3">Quando</th><th className="p-3">Quem</th><th className="p-3">Ação</th><th className="p-3">Detalhes</th><th className="p-3">IP</th></tr></thead>
            <tbody className="divide-y">
              {(q.data?.items ?? []).map((a) => (
                <tr key={a.id}>
                  <td className="whitespace-nowrap p-3 text-xs">{formatDateTime(a.createdAt)}</td>
                  <td className="p-3 text-xs">{a.actor?.name ?? "sistema"}</td>
                  <td className="p-3 text-xs font-medium">{ACTION_LABELS[a.action] ?? a.action}</td>
                  <td className="max-w-xs truncate p-3 font-mono text-[11px] text-muted-foreground" title={JSON.stringify(a.data)}>{Object.keys(a.data).length ? JSON.stringify(a.data) : "—"}</td>
                  <td className="p-3 font-mono text-[11px]">{a.ip ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex justify-end gap-2">
        {cursor && <Button variant="ghost" size="sm" onClick={() => setCursor(undefined)}>Mais recentes</Button>}
        {q.data?.nextCursor && <Button variant="outline" size="sm" onClick={() => setCursor(q.data.nextCursor!)}>Mais antigos</Button>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- status
function Status() {
  const q = useQuery({ queryKey: ["admin", "status"], queryFn: adminApi.status, refetchInterval: 30_000 });
  if (q.isPending) return <Loading />;
  if (q.isError) return <InlineError>{getErrorMessage(q.error)}</InlineError>;
  const s = q.data;
  const hours = Math.floor(s.uptimeSeconds / 3600);
  const Flag = ({ ok, label }: { ok: boolean; label: string }) => (
    <div className="flex items-center justify-between text-sm"><span>{label}</span><span className={cn("text-xs font-semibold", ok ? "text-success" : "text-muted-foreground")}>{ok ? "configurado" : "sem credenciais"}</span></div>
  );
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Banco de dados" value={s.database.ok ? "OK" : "Falha"} hint={`${s.database.latencyMs} ms`} />
        <Stat label="No ar há" value={hours >= 1 ? `${hours} h` : `${Math.round(s.uptimeSeconds / 60)} min`} hint="desde o último deploy/reinício" />
        <Stat label="Conexões em tempo real" value={s.realtimeConnections} />
        <Stat label="Jobs com falha (24 h)" value={s.failedJobs24h.reduce((n, f) => n + f.count, 0)} />
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        <Card className="space-y-2"><p className="text-sm font-semibold">Fila de jobs</p>{Object.entries(s.jobs).map(([k, v]) => <div key={k} className="flex justify-between text-sm"><span>{k}</span><span className="tabular-nums">{v}</span></div>)}</Card>
        <Card className="space-y-2"><p className="text-sm font-semibold">Entregas (24 h)</p>{Object.keys(s.deliveries24h).length ? Object.entries(s.deliveries24h).map(([k, v]) => <div key={k} className="flex justify-between text-sm"><span>{k.replace(":", " · ")}</span><span className="tabular-nums">{v}</span></div>) : <p className="text-sm text-muted-foreground">Nenhuma entrega no período.</p>}</Card>
        <Card className="space-y-2"><p className="text-sm font-semibold">Integrações</p><Flag ok={s.integrations.email} label="E-mail (Resend)" /><Flag ok={s.integrations.push} label="Web Push (VAPID)" /><Flag ok={s.integrations.google} label="Login com Google" /></Card>
      </div>
      {s.failedJobs24h.length > 0 && (
        <Card className="space-y-2">
          <p className="text-sm font-semibold">Falhas recentes</p>
          {s.failedJobs24h.map((f) => <div key={f.type} className="text-sm"><span className="font-medium">{f.type}</span> · {f.count}× <span className="block truncate font-mono text-xs text-muted-foreground">{f.lastError}</span></div>)}
        </Card>
      )}
    </div>
  );
}

const VIEWS: Record<string, () => JSX.Element> = { "": Overview, usuarios: Users, workspaces: Workspaces, suporte: Tickets, avisos: Announcements, contatos: Contacts, auditoria: Audit, status: Status };

export default function AdminPage() {
  const { secao = "" } = useParams();
  const navigate = useNavigate();
  const user = useAuth().user;
  // Sonda de acesso: a API decide (admin + 2FA). A tela só traduz o erro.
  const probe = useQuery({ queryKey: ["admin", "overview"], queryFn: adminApi.overview, enabled: Boolean(user?.isPlatformAdmin), retry: false });
  useCrumbs([{ label: "Administração" }]);

  if (!user?.isPlatformAdmin) {
    return <div className="mx-auto max-w-lg px-4 py-16"><EmptyState icon={ShieldAlert} title="Acesso restrito" description="Esta área é exclusiva da administração do Andamo." /></div>;
  }
  if (probe.error instanceof ApiError && probe.error.code === "ADMIN_MFA_REQUIRED") {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <EmptyState icon={ShieldAlert} title="Ative a verificação em duas etapas" description="Por segurança, o painel administrativo exige 2FA ativo na sua conta." />
        <Button className="mt-4" asChild><Link to="/app/configuracoes/seguranca">Configurar agora</Link></Button>
      </div>
    );
  }
  const View = VIEWS[secao] ?? Overview;
  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6 lg:py-8">
      <div className="flex items-center gap-3">
        <Activity className="h-6 w-6 text-brand" aria-hidden />
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">Administração</h1>
          <p className="text-sm text-muted-foreground">Visão da plataforma. Por privacidade, aqui não aparece o conteúdo das tarefas dos clientes.</p>
        </div>
      </div>
      <nav aria-label="Seções da administração" className="scrollbar-thin -mx-4 flex gap-1 overflow-x-auto px-4 pb-1">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => navigate(s.id ? `/app/admin/${s.id}` : "/app/admin")}
            aria-current={secao === s.id ? "page" : undefined}
            className={cn("whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors", secao === s.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground")}
          >
            {s.label}
          </button>
        ))}
      </nav>
      {probe.isError && !(probe.error instanceof ApiError && probe.error.code === "ADMIN_MFA_REQUIRED") ? <InlineError>{getErrorMessage(probe.error)}</InlineError> : <View />}
    </div>
  );
}
