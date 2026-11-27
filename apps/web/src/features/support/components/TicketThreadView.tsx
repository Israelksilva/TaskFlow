import { useState, type ReactNode } from "react";
import { Headset, Loader2, Send } from "lucide-react";
import { TICKET_STATUS_LABELS, TICKET_TYPE_LABELS, type TicketStatus } from "@andamo/shared";
import { UserAvatar } from "@/components/feedback/UserAvatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TicketThread } from "../api";

const STATUS_STYLE: Record<TicketStatus, string> = {
  open: "bg-primary/10 text-primary",
  in_progress: "bg-warning/15 text-warning",
  waiting_user: "bg-coral/15 text-coral",
  resolved: "bg-success/15 text-success",
  closed: "bg-muted text-muted-foreground",
};

/** Na visão da equipe, "aguardando você" vira "aguardando cliente". */
export function TicketStatusBadge({ status, viewer = "user" }: { status: TicketStatus; viewer?: "user" | "staff" }) {
  const label = viewer === "staff" && status === "waiting_user" ? "Aguardando cliente" : TICKET_STATUS_LABELS[status];
  return <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", STATUS_STYLE[status])}>{label}</span>;
}

/** Conversa do chamado. `viewer="staff"` destaca as mensagens do cliente; `viewer="user"` as da equipe. */
export function TicketThreadView({
  thread,
  viewer,
  onReply,
  replying,
  actions,
}: {
  thread: TicketThread;
  viewer: "user" | "staff";
  onReply?: (message: string) => Promise<unknown>;
  replying?: boolean;
  actions?: ReactNode;
}) {
  const [message, setMessage] = useState("");
  const t = thread.ticket;
  const closed = t.status === "closed";
  return (
    <div className="flex h-full flex-col">
      <header className="space-y-2 border-b px-5 pb-4 pt-5">
        <div className="flex flex-wrap items-center gap-2 pr-8 text-xs text-muted-foreground">
          <TicketStatusBadge status={t.status} viewer={viewer} />
          <span>{TICKET_TYPE_LABELS[t.type]}</span>
          <span>· aberto em {formatDateTime(t.createdAt)}</span>
          {viewer === "staff" && t.requester && <span>· {t.requester.name} ({t.requester.email})</span>}
          {t.workspaceName && <span>· {t.workspaceName}</span>}
        </div>
        <h2 className="font-display text-xl font-bold">{t.subject}</h2>
        {actions}
      </header>
      <ol className="scrollbar-thin flex-1 space-y-4 overflow-y-auto px-5 py-4">
        {thread.messages.map((m) => {
          const mine = viewer === "staff" ? m.isStaff : !m.isStaff;
          return (
            <li key={m.id} className={cn("flex gap-3", mine && "flex-row-reverse")}>
              {m.isStaff ? (
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-white"><Headset className="h-4 w-4" aria-hidden /></span>
              ) : m.author ? (
                <UserAvatar user={m.author} className="h-8 w-8 ring-0" />
              ) : (
                <span className="h-8 w-8 rounded-full bg-muted" />
              )}
              <div className={cn("max-w-[80%] rounded-2xl px-4 py-2.5 text-sm", mine ? "bg-primary text-primary-foreground" : "bg-muted")}>
                <p className={cn("mb-0.5 text-xs font-semibold", mine ? "text-primary-foreground/80" : "text-muted-foreground")}>
                  {m.isStaff ? "Suporte Andamo" : (m.author?.name ?? "Conta removida")} · {formatDateTime(m.createdAt)}
                </p>
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
              </div>
            </li>
          );
        })}
      </ol>
      {onReply && !closed && (
        <form
          className="flex gap-2 border-t p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (message.trim().length >= 5 && !replying) void onReply(message.trim()).then(() => setMessage(""));
          }}
        >
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={2}
            maxLength={5000}
            placeholder={viewer === "staff" ? "Responder ao cliente…" : "Escreva sua mensagem…"}
            aria-label="Mensagem"
            className="resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) e.currentTarget.form?.requestSubmit();
            }}
          />
          <Button type="submit" disabled={message.trim().length < 5 || replying} aria-label="Enviar" className="self-end">
            {replying ? <Loader2 className="animate-spin" /> : <Send />}
          </Button>
        </form>
      )}
      {closed && <p className="border-t p-4 text-center text-sm text-muted-foreground">Chamado encerrado.</p>}
    </div>
  );
}
