import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Mail, Plus, Trash2, UserMinus, Users, X } from "lucide-react";
import { assignableRoles, can, ROLE_DESCRIPTIONS, ROLE_LABELS, type Member, type Role, type Team } from "@andamo/shared";
import { EmptyState } from "@/components/feedback/EmptyState";
import { InlineError } from "@/components/feedback/InlineError";
import { AvatarStack, UserAvatar } from "@/components/feedback/UserAvatar";
import { useCrumbs } from "@/components/layout/AppHeader";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/features/auth/use-auth";
import { MemberPicker } from "@/features/tasks/components/Pickers";
import { getErrorMessage } from "@/lib/api-client";
import { relativeTime } from "@/lib/format";
import { workspacesApi } from "../api";
import { useCurrentWorkspace, useMembers, useTeams, useWsMutation, wsKeys } from "../hooks";

function MemberRow({ m, wsId, myRole, isMe }: { m: Member; wsId: string; myRole: Role; isMe: boolean }) {
  const [editing, setEditing] = useState(false);
  const [jobTitle, setJobTitle] = useState(m.jobTitle ?? "");
  const [department, setDepartment] = useState(m.department ?? "");
  const [capacity, setCapacity] = useState(m.capacityHours?.toString() ?? "");
  const invalidate = [wsKeys.members(wsId)];
  const update = useWsMutation((input: Parameters<typeof workspacesApi.updateMember>[2]) => workspacesApi.updateMember(wsId, m.id, input), { invalidate, success: "Membro atualizado" });
  const remove = useWsMutation(() => workspacesApi.removeMember(wsId, m.id), { invalidate: [...invalidate, wsKeys.all], success: isMe ? "Você saiu do workspace" : "Membro removido" });
  const manageable = can(myRole, "members.manage") && m.role !== "owner" && !isMe;
  const roles = assignableRoles(myRole);

  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3">
      <UserAvatar user={m} className="h-9 w-9 ring-0" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {m.name} {isMe && <span className="text-xs text-muted-foreground">(você)</span>}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {[m.jobTitle, m.department, m.email].filter(Boolean).join(" · ")}
          {m.capacityHours != null && ` · ${m.capacityHours}h/semana`}
        </p>
      </div>
      {manageable ? (
        <Select value={m.role} onValueChange={(role) => update.mutate({ role: role as Role })}>
          <SelectTrigger className="h-8 w-40" aria-label={`Papel de ${m.name}`}><SelectValue /></SelectTrigger>
          <SelectContent>
            {[...new Set([m.role, ...roles])].map((r) => (
              <SelectItem key={r} value={r} disabled={!roles.includes(r)}>{ROLE_LABELS[r]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">{ROLE_LABELS[m.role]}</span>
      )}
      {(isMe || can(myRole, "members.manage")) && (
        <Button variant="ghost" size="sm" className="h-8" onClick={() => setEditing(true)}>Editar</Button>
      )}
      {(manageable || (isMe && m.role !== "owner")) && (
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove.mutate(undefined)} aria-label={isMe ? "Sair do workspace" : `Remover ${m.name}`}>
          <UserMinus className="h-4 w-4" />
        </Button>
      )}
      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{m.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label htmlFor={`jt-${m.id}`}>Cargo</Label><Input id={`jt-${m.id}`} maxLength={80} value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor={`dp-${m.id}`}>Departamento</Label><Input id={`dp-${m.id}`} maxLength={80} value={department} onChange={(e) => setDepartment(e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor={`cp-${m.id}`}>Capacidade (horas por semana)</Label><Input id={`cp-${m.id}`} type="number" min={0} max={168} value={capacity} onChange={(e) => setCapacity(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button>
            <Button
              disabled={update.isPending}
              onClick={() =>
                update.mutate(
                  { jobTitle: jobTitle || null, department: department || null, capacityHours: capacity === "" ? null : Math.min(168, Math.max(0, Number(capacity))) },
                  { onSuccess: () => setEditing(false) },
                )
              }
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </li>
  );
}

function InviteForm({ wsId, myRole }: { wsId: string; myRole: Role }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("member");
  const invite = useWsMutation(() => workspacesApi.invite(wsId, email, role), {
    invalidate: [wsKeys.invitations(wsId)],
    success: `Convite enviado para ${email}`,
    onSuccess: () => setEmail(""),
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (email && !invite.isPending) invite.mutate(undefined);
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
      <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@empresa.com" aria-label="E-mail do convidado" className="sm:flex-1" />
      <Select value={role} onValueChange={(v) => setRole(v as Role)}>
        <SelectTrigger className="sm:w-44" aria-label="Papel"><SelectValue /></SelectTrigger>
        <SelectContent>
          {assignableRoles(myRole).map((r) => (
            <SelectItem key={r} value={r}>
              <span className="block">{ROLE_LABELS[r]}</span>
              <span className="block text-xs text-muted-foreground">{ROLE_DESCRIPTIONS[r]}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button type="submit" disabled={!email || invite.isPending}>
        {invite.isPending ? <Loader2 className="animate-spin" /> : <Mail />} Convidar
      </Button>
    </form>
  );
}

function TeamDialog({ open, onOpenChange, wsId, team, members }: { open: boolean; onOpenChange: (o: boolean) => void; wsId: string; team: Team | null; members: Member[] }) {
  const [name, setName] = useState(team?.name ?? "");
  const [description, setDescription] = useState(team?.description ?? "");
  const [memberIds, setMemberIds] = useState<string[]>(team?.memberIds ?? []);
  const save = useWsMutation(() => workspacesApi.saveTeam(wsId, team?.id ?? null, { name, description, color: team?.color ?? "#6D5DFC", memberIds }), {
    invalidate: [wsKeys.teams(wsId)],
    success: team ? "Equipe atualizada" : "Equipe criada",
    onSuccess: () => onOpenChange(false),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{team ? "Editar equipe" : "Nova equipe"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label htmlFor="team-name">Nome</Label><Input id="team-name" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="team-desc">Descrição</Label><Input id="team-desc" maxLength={280} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Membros</Label><MemberPicker members={members} value={memberIds} onChange={setMemberIds} /></div>
        </div>
        {save.isError && <InlineError>{getErrorMessage(save.error)}</InlineError>}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={name.trim().length < 2 || save.isPending} onClick={() => save.mutate(undefined)}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function TeamPage() {
  const ws = useCurrentWorkspace();
  const { user } = useAuth();
  const members = useMembers(ws.id);
  const teams = useTeams(ws.id);
  const canInvite = can(ws.role, "members.invite");
  const invitations = useQuery({ queryKey: wsKeys.invitations(ws.id), queryFn: () => workspacesApi.invitations(ws.id), enabled: canInvite });
  const revoke = useWsMutation((id: string) => workspacesApi.revokeInvitation(ws.id, id), { invalidate: [wsKeys.invitations(ws.id)], success: "Convite revogado" });
  const removeTeam = useWsMutation((id: string) => workspacesApi.removeTeam(ws.id, id), { invalidate: [wsKeys.teams(ws.id)], success: "Equipe excluída" });
  const [teamDialog, setTeamDialog] = useState<{ open: boolean; team: Team | null }>({ open: false, team: null });
  useCrumbs([{ label: ws.name, to: `/app/w/${ws.id}` }, { label: "Equipe" }]);
  const list = members.data ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6 lg:py-8">
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Equipe</h1>
        <p className="mt-1 text-sm text-muted-foreground">Pessoas, papéis e equipes de {ws.name}.</p>
      </div>
      <Tabs defaultValue="members">
        <TabsList>
          <TabsTrigger value="members">Membros ({list.length})</TabsTrigger>
          <TabsTrigger value="teams">Equipes</TabsTrigger>
        </TabsList>
        <TabsContent value="members" className="space-y-4">
          {canInvite && (
            <section className="rounded-xl border bg-card p-5 shadow-card">
              <h2 className="mb-1 font-display font-bold">Convidar pessoas</h2>
              {ws.isPersonal ? (
                <p className="text-sm text-muted-foreground">Este é seu workspace pessoal. Crie um workspace de equipe (no seletor do menu) para convidar pessoas.</p>
              ) : (
                <>
                  <p className="mb-3 text-sm text-muted-foreground">O convite chega por e-mail e vale por 7 dias, apenas para o endereço convidado.</p>
                  <InviteForm wsId={ws.id} myRole={ws.role} />
                </>
              )}
              {(invitations.data?.length ?? 0) > 0 && (
                <ul className="mt-4 divide-y rounded-lg border">
                  {invitations.data!.map((i) => (
                    <li key={i.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground" aria-hidden />
                      <span className="min-w-0 flex-1 truncate">{i.email}</span>
                      <span className="text-xs text-muted-foreground">{ROLE_LABELS[i.role]} · enviado {relativeTime(i.createdAt)}</span>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => revoke.mutate(i.id)} aria-label={`Revogar convite de ${i.email}`}><X className="h-4 w-4" /></Button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
          {members.isError && <InlineError>{getErrorMessage(members.error)}</InlineError>}
          {members.isPending ? (
            <Skeleton className="h-40 rounded-xl" />
          ) : (
            <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-card">
              {list.map((m) => <MemberRow key={m.id} m={m} wsId={ws.id} myRole={ws.role} isMe={m.id === user?.id} />)}
            </ul>
          )}
        </TabsContent>
        <TabsContent value="teams" className="space-y-4">
          {can(ws.role, "teams.manage") && (
            <Button onClick={() => setTeamDialog({ open: true, team: null })}><Plus /> Nova equipe</Button>
          )}
          {!teams.data?.length ? (
            <EmptyState icon={Users} title="Nenhuma equipe" description="Equipes agrupam pessoas por área (ex.: Design, Vendas) e podem ser vinculadas a projetos." />
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {teams.data.map((t) => (
                <li key={t.id} className="rounded-xl border bg-card p-4 shadow-card">
                  <div className="flex items-start gap-2">
                    <span className="mt-1 h-3 w-3 rounded" style={{ background: t.color }} aria-hidden />
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold">{t.name}</h3>
                      {t.description && <p className="text-sm text-muted-foreground">{t.description}</p>}
                    </div>
                    {can(ws.role, "teams.manage") && (
                      <>
                        <Button variant="ghost" size="sm" className="h-7" onClick={() => setTeamDialog({ open: true, team: t })}>Editar</Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeTeam.mutate(t.id)} aria-label={`Excluir equipe ${t.name}`}><Trash2 className="h-4 w-4" /></Button>
                      </>
                    )}
                  </div>
                  <AvatarStack users={list.filter((m) => t.memberIds.includes(m.id))} max={6} className="mt-3" />
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
      {teamDialog.open && <TeamDialog open onOpenChange={(o) => !o && setTeamDialog({ open: false, team: null })} wsId={ws.id} team={teamDialog.team} members={list} />}
    </div>
  );
}
