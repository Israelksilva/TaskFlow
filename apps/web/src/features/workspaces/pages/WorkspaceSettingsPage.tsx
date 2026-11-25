import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Archive, Crown, Tag, Trash2 } from "lucide-react";
import { can } from "@andamo/shared";
import { useCrumbs } from "@/components/layout/AppHeader";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LabelChip } from "@/features/tasks/components/Pickers";
import { PROJECT_COLORS } from "@/features/projects/components/ProjectFormDialog";
import { cn } from "@/lib/utils";
import { workspacesApi } from "../api";
import { useCurrentWorkspace, useLabels, useMembers, useWsMutation, wsKeys } from "../hooks";

function Section({ title, description, children, danger }: { title: string; description?: string; children: React.ReactNode; danger?: boolean }) {
  return (
    <section className={cn("rounded-xl border bg-card p-5 shadow-card", danger && "border-destructive/30")}>
      <h2 className={cn("font-display font-bold", danger && "text-destructive")}>{title}</h2>
      {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function WorkspaceSettingsPage() {
  const ws = useCurrentWorkspace();
  const navigate = useNavigate();
  const members = useMembers(ws.id).data ?? [];
  const labels = useLabels(ws.id).data ?? [];
  const [name, setName] = useState(ws.name);
  const [logoUrl, setLogoUrl] = useState(ws.logoUrl ?? "");
  const [labelName, setLabelName] = useState("");
  const [labelColor, setLabelColor] = useState(PROJECT_COLORS[0]);
  const [transferTo, setTransferTo] = useState("");
  const [confirm, setConfirm] = useState<"transfer" | "archive" | null>(null);
  useCrumbs([{ label: ws.name, to: `/app/w/${ws.id}` }, { label: "Ajustes do workspace" }]);
  useEffect(() => {
    setName(ws.name);
    setLogoUrl(ws.logoUrl ?? "");
  }, [ws.name, ws.logoUrl]);

  const all = [wsKeys.all];
  const update = useWsMutation(() => workspacesApi.update(ws.id, { name, logoUrl: logoUrl || null }), { invalidate: all, success: "Workspace atualizado" });
  const createLabel = useWsMutation(() => workspacesApi.createLabel(ws.id, { name: labelName, color: labelColor }), { invalidate: [wsKeys.labels(ws.id)], success: "Etiqueta criada", onSuccess: () => setLabelName("") });
  const removeLabel = useWsMutation((id: string) => workspacesApi.removeLabel(ws.id, id), { invalidate: [wsKeys.labels(ws.id)] });
  const transfer = useWsMutation(() => workspacesApi.transfer(ws.id, transferTo), { invalidate: all, success: "Propriedade transferida" });
  const archive = useWsMutation((archived: boolean) => workspacesApi.archive(ws.id, archived), {
    invalidate: all,
    success: (w) => (w.archivedAt ? "Workspace arquivado (somente leitura)" : "Workspace reativado"),
  });
  const canUpdate = can(ws.role, "workspace.update");
  const isOwner = ws.role === "owner";

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6 lg:py-8">
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Ajustes do workspace</h1>
        <p className="mt-1 text-sm text-muted-foreground">Identidade, etiquetas e administração de {ws.name}.</p>
      </div>

      <Section title="Identidade" description="Nome e logo exibidos para todos os membros.">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5"><Label htmlFor="ws-name">Nome</Label><Input id="ws-name" disabled={!canUpdate} maxLength={80} value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="ws-logo">URL do logo (https)</Label><Input id="ws-logo" disabled={!canUpdate} placeholder="https://…" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} /></div>
        </div>
        {canUpdate && <Button className="mt-4" disabled={update.isPending || name.trim().length < 2} onClick={() => update.mutate(undefined)}>Salvar</Button>}
      </Section>

      <Section title="Etiquetas" description="Classifique tarefas por tema, cliente ou tipo de trabalho.">
        <div className="flex flex-wrap gap-2">
          {labels.map((l) => (
            <span key={l.id} className="flex items-center gap-1">
              <LabelChip label={l} />
              {can(ws.role, "labels.manage") && (
                <button className="rounded p-0.5 text-muted-foreground hover:text-destructive" onClick={() => removeLabel.mutate(l.id)} aria-label={`Excluir etiqueta ${l.name}`}><Trash2 className="h-3 w-3" /></button>
              )}
            </span>
          ))}
          {!labels.length && <p className="text-sm text-muted-foreground">Nenhuma etiqueta.</p>}
        </div>
        {can(ws.role, "labels.manage") && (
          <form className="mt-4 flex flex-wrap items-center gap-2" onSubmit={(e) => (e.preventDefault(), labelName.trim() && createLabel.mutate(undefined))}>
            <Input value={labelName} onChange={(e) => setLabelName(e.target.value)} placeholder="Nova etiqueta" maxLength={40} className="h-9 w-48" aria-label="Nome da etiqueta" />
            <div className="flex gap-1">
              {PROJECT_COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setLabelColor(c)} aria-label={`Cor ${c}`} aria-pressed={labelColor === c} className={cn("h-6 w-6 rounded-md", labelColor === c && "ring-2 ring-foreground ring-offset-2 ring-offset-background")} style={{ background: c }} />
              ))}
            </div>
            <Button type="submit" size="sm" disabled={!labelName.trim()}><Tag /> Criar</Button>
          </form>
        )}
      </Section>

      {isOwner && !ws.isPersonal && (
        <Section title="Transferir propriedade" description="O novo proprietário assume cobrança e administração total; você passa a administrador.">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Select value={transferTo} onValueChange={setTransferTo}>
              <SelectTrigger className="sm:w-72" aria-label="Novo proprietário"><SelectValue placeholder="Escolha um membro" /></SelectTrigger>
              <SelectContent>
                {members.filter((m) => m.role !== "owner" && m.role !== "guest" && m.role !== "viewer").map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" disabled={!transferTo} onClick={() => setConfirm("transfer")}><Crown /> Transferir</Button>
          </div>
        </Section>
      )}

      {isOwner && !ws.isPersonal && (
        <Section title={ws.archivedAt ? "Workspace arquivado" : "Arquivar workspace"} description="Workspaces arquivados ficam somente leitura para todos. Você pode reativar depois." danger>
          <Button variant="outline" className="border-destructive/40 text-destructive" onClick={() => (ws.archivedAt ? archive.mutate(false) : setConfirm("archive"))}>
            <Archive /> {ws.archivedAt ? "Reativar" : "Arquivar workspace"}
          </Button>
        </Section>
      )}

      <AlertDialog open={Boolean(confirm)} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm === "transfer" ? "Transferir a propriedade?" : `Arquivar ${ws.name}?`}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === "transfer"
                ? `${members.find((m) => m.id === transferTo)?.name ?? "O membro"} passará a ser o proprietário. Somente essa pessoa poderá desfazer.`
                : "Ninguém poderá criar ou editar conteúdo até o workspace ser reativado."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirm === "transfer") transfer.mutate(undefined, { onSuccess: () => navigate(`/app/w/${ws.id}`) });
                else archive.mutate(true);
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
