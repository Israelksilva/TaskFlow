import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Bug, HelpCircle, Keyboard, Lightbulb, Loader2, MessageSquarePlus } from "lucide-react";
import { toast } from "sonner";
import { TICKET_TYPE_LABELS, TICKET_TYPES, type TicketType } from "@andamo/shared";
import { EmptyState } from "@/components/feedback/EmptyState";
import { InlineError } from "@/components/feedback/InlineError";
import { useCrumbs } from "@/components/layout/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useWorkspaces } from "@/features/workspaces/hooks";
import { getErrorMessage } from "@/lib/api-client";
import { relativeTime } from "@/lib/format";
import { workspaceStorage } from "@/lib/storage";
import { supportApi } from "./api";
import { TicketStatusBadge, TicketThreadView } from "./components/TicketThreadView";

const KEY = ["support", "tickets"] as const;

function NewTicketForm({ onCreated, initialType = "question" }: { onCreated: (id: string) => void; initialType?: TicketType }) {
  const qc = useQueryClient();
  const workspaces = useWorkspaces().data ?? [];
  const [type, setType] = useState<TicketType>(initialType);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [workspaceId, setWorkspaceId] = useState(workspaceStorage.get() ?? "none");
  const create = useMutation({
    mutationFn: () => supportApi.create({ type, subject, message, workspaceId: workspaceId === "none" ? undefined : workspaceId }),
    onSuccess: (t) => {
      toast.success("Chamado aberto", { description: "Você será avisado quando o suporte responder." });
      setSubject("");
      setMessage("");
      void qc.invalidateQueries({ queryKey: KEY });
      onCreated(t.id);
    },
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (subject.trim().length >= 3 && message.trim().length >= 5 && !create.isPending) create.mutate();
  };
  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border bg-card p-5 shadow-card">
      <h2 className="font-display font-bold">Abrir um chamado</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Tipo</Label>
          <Select value={type} onValueChange={(v) => setType(v as TicketType)}>
            <SelectTrigger aria-label="Tipo"><SelectValue /></SelectTrigger>
            <SelectContent>{TICKET_TYPES.map((t) => <SelectItem key={t} value={t}>{TICKET_TYPE_LABELS[t]}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Workspace relacionado</Label>
          <Select value={workspaceId} onValueChange={setWorkspaceId}>
            <SelectTrigger aria-label="Workspace"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhum em específico</SelectItem>
              {workspaces.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="tk-subject">Assunto</Label>
        <Input id="tk-subject" maxLength={140} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Resuma em uma frase" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="tk-message">Mensagem</Label>
        <Textarea
          id="tk-message"
          rows={5}
          maxLength={5000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={type === "bug" ? "O que você fez, o que esperava e o que aconteceu? Navegador e dispositivo ajudam." : "Conte com detalhes como podemos ajudar."}
        />
      </div>
      {create.isError && <InlineError>{getErrorMessage(create.error)}</InlineError>}
      <Button type="submit" disabled={subject.trim().length < 3 || message.trim().length < 5 || create.isPending}>
        {create.isPending ? <Loader2 className="animate-spin" /> : <MessageSquarePlus />} Enviar chamado
      </Button>
    </form>
  );
}

function ThreadSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const thread = useQuery({ queryKey: [...KEY, id], queryFn: () => supportApi.thread(id!), enabled: Boolean(id), refetchInterval: 30_000 });
  const refresh = (data: Awaited<ReturnType<typeof supportApi.thread>>) => {
    qc.setQueryData([...KEY, id], data);
    void qc.invalidateQueries({ queryKey: KEY });
  };
  const reply = useMutation({ mutationFn: (m: string) => supportApi.reply(id!, m), onSuccess: refresh, onError: (e) => toast.error(getErrorMessage(e)) });
  const close = useMutation({ mutationFn: () => supportApi.close(id!), onSuccess: refresh, onError: (e) => toast.error(getErrorMessage(e)) });
  return (
    <Sheet open={Boolean(id)} onOpenChange={(o) => !o && onClose()}>
      <SheetContent aria-describedby={undefined} className="sm:max-w-xl">
        <SheetTitle className="sr-only">Chamado</SheetTitle>
        {thread.isPending ? (
          <Skeleton className="m-6 h-40" />
        ) : thread.isError ? (
          <div className="p-6"><InlineError>{getErrorMessage(thread.error)}</InlineError></div>
        ) : (
          <TicketThreadView
            thread={thread.data}
            viewer="user"
            replying={reply.isPending}
            onReply={(m) => reply.mutateAsync(m)}
            actions={
              thread.data.ticket.status !== "closed" && (
                <Button size="sm" variant="outline" onClick={() => close.mutate()} disabled={close.isPending}>Encerrar chamado</Button>
              )
            }
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

export default function SupportPage() {
  const [params, setParams] = useSearchParams();
  const openId = params.get("chamado");
  const tickets = useQuery({ queryKey: KEY, queryFn: supportApi.tickets });
  const [preset, setPreset] = useState<{ type: TicketType; n: number }>({ type: "question", n: 0 });
  useCrumbs([{ label: "Ajuda e suporte" }]);
  const open = (id: string | null) =>
    setParams((p) => {
      if (id) p.set("chamado", id);
      else p.delete("chamado");
      return p;
    });

  const shortcuts = [
    { icon: BookOpen, title: "Central de ajuda", text: "Tutoriais e perguntas frequentes", to: "/ajuda" },
    { icon: Keyboard, title: "Atalhos de teclado", text: "Ctrl+K, N, / e mais", to: "/ajuda" },
    { icon: Bug, title: "Relatar um erro", text: "Abra um chamado do tipo “Relato de erro”", to: null, type: "bug" as const },
    { icon: Lightbulb, title: "Sugerir melhoria", text: "Abra um chamado do tipo “Sugestão”", to: null, type: "suggestion" as const },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6 lg:py-8">
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Ajuda e suporte</h1>
        <p className="mt-1 text-sm text-muted-foreground">Tire dúvidas, relate problemas ou sugira melhorias. Respondemos por aqui e avisamos na sua caixa de entrada.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {shortcuts.map((s) =>
          s.to ? (
            <Link key={s.title} to={s.to} className="rounded-xl border bg-card p-4 shadow-card transition-colors hover:border-primary/40">
              <s.icon className="h-5 w-5 text-primary" aria-hidden />
              <p className="mt-2 text-sm font-semibold">{s.title}</p>
              <p className="text-xs text-muted-foreground">{s.text}</p>
            </Link>
          ) : (
            <a key={s.title} href="#novo-chamado" className="rounded-xl border bg-card p-4 shadow-card transition-colors hover:border-primary/40" onClick={(e) => {
                e.preventDefault();
                if (s.type) setPreset((p) => ({ type: s.type, n: p.n + 1 }));
                setTimeout(() => document.getElementById("tk-subject")?.focus(), 0);
              }}>
              <s.icon className="h-5 w-5 text-primary" aria-hidden />
              <p className="mt-2 text-sm font-semibold">{s.title}</p>
              <p className="text-xs text-muted-foreground">{s.text}</p>
            </a>
          ),
        )}
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]" id="novo-chamado">
        <NewTicketForm key={preset.n} initialType={preset.type} onCreated={(id) => open(id)} />
        <section className="space-y-3">
          <h2 className="font-display font-bold">Meus chamados</h2>
          {tickets.isError && <InlineError>{getErrorMessage(tickets.error)}</InlineError>}
          {tickets.isPending ? (
            <Skeleton className="h-40 rounded-xl" />
          ) : !tickets.data?.length ? (
            <EmptyState icon={HelpCircle} title="Nenhum chamado ainda" description="Quando você abrir um chamado, ele aparece aqui com o status do atendimento." />
          ) : (
            <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-card">
              {tickets.data.map((t) => (
                <li key={t.id}>
                  <button onClick={() => open(t.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-accent/40">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{t.subject}</p>
                      <p className="text-xs text-muted-foreground">{TICKET_TYPE_LABELS[t.type]} · atualizado {relativeTime(t.lastMessageAt)} · {t.messageCount} mensagem(ns)</p>
                    </div>
                    <TicketStatusBadge status={t.status} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <ThreadSheet id={openId} onClose={() => open(null)} />
    </div>
  );
}
