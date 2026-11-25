import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CornerDownRight, Loader2, MoreHorizontal, Pencil, SmilePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { can, normalizeText, type Comment, type Member, type Role } from "@andamo/shared";
import { MarkdownView } from "@/components/editor/MarkdownEditor";
import { UserAvatar } from "@/components/feedback/UserAvatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { getErrorMessage } from "@/lib/api-client";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { tasksApi } from "../api";
import { taskKeys } from "../hooks";

const EMOJIS = ["👍", "🎉", "❤️", "👀", "🚀", "✅"];

/** Campo de comentário com autocomplete de @menções (gera `@[Nome](id)`). */
function Composer({
  members,
  onSubmit,
  pending,
  initial = "",
  placeholder,
  autoFocus,
  onCancel,
}: {
  members: Member[];
  onSubmit: (body: string) => Promise<unknown>;
  pending: boolean;
  initial?: string;
  placeholder: string;
  autoFocus?: boolean;
  onCancel?: () => void;
}) {
  const [body, setBody] = useState(initial);
  const [mention, setMention] = useState<{ query: string; start: number } | null>(null);
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLTextAreaElement>(null);
  const options = useMemo(
    () => (mention ? members.filter((m) => normalizeText(m.name).includes(normalizeText(mention.query))).slice(0, 6) : []),
    [mention, members],
  );

  const detect = (value: string, cursor: number) => {
    const match = /(^|\s)@([\p{L}\d._-]{0,30})$/u.exec(value.slice(0, cursor));
    setMention(match ? { query: match[2], start: cursor - match[2].length - 1 } : null);
    setActive(0);
  };

  const pick = (m: Member) => {
    if (!mention || !ref.current) return;
    const cursor = ref.current.selectionStart;
    const token = `@[${m.name}](${m.id}) `;
    const next = body.slice(0, mention.start) + token + body.slice(cursor);
    setBody(next);
    setMention(null);
    requestAnimationFrame(() => {
      ref.current?.focus();
      const pos = mention.start + token.length;
      ref.current?.setSelectionRange(pos, pos);
    });
  };

  const submit = async () => {
    if (!body.trim() || pending) return;
    await onSubmit(body.trim());
    setBody("");
  };

  return (
    <div className="relative">
      <Textarea
        ref={ref}
        rows={2}
        maxLength={5000}
        autoFocus={autoFocus}
        value={body}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(e) => {
          setBody(e.target.value);
          detect(e.target.value, e.target.selectionStart);
        }}
        onKeyDown={(e) => {
          if (mention && options.length) {
            if (e.key === "ArrowDown") return e.preventDefault(), setActive((a) => (a + 1) % options.length);
            if (e.key === "ArrowUp") return e.preventDefault(), setActive((a) => (a - 1 + options.length) % options.length);
            if (e.key === "Enter" || e.key === "Tab") return e.preventDefault(), pick(options[active]);
            if (e.key === "Escape") return e.preventDefault(), setMention(null);
          }
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            void submit();
          }
        }}
        className="resize-none pr-24"
      />
      {mention && options.length > 0 && (
        <div role="listbox" aria-label="Mencionar" className="absolute bottom-full left-0 z-20 mb-1 w-64 rounded-lg border bg-popover p-1 shadow-elevated">
          {options.map((m, i) => (
            <button
              key={m.id}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(m);
              }}
              className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm", i === active && "bg-accent")}
            >
              <UserAvatar user={m} className="h-5 w-5 ring-0" /> {m.name}
            </button>
          ))}
        </div>
      )}
      <div className="absolute bottom-2 right-2 flex gap-1">
        {onCancel && (
          <Button size="sm" variant="ghost" className="h-7" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button size="sm" className="h-7" disabled={!body.trim() || pending} onClick={() => void submit()}>
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Enviar"}
        </Button>
      </div>
    </div>
  );
}

export function TaskComments({
  workspaceId,
  taskId,
  members,
  userId,
  role,
}: {
  workspaceId: string;
  taskId: string;
  members: Member[];
  userId: string;
  role: Role;
}) {
  const qc = useQueryClient();
  const key = taskKeys.comments(workspaceId, taskId);
  const comments = useQuery({ queryKey: key, queryFn: () => tasksApi.comments(workspaceId, taskId) });
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: key });
    void qc.invalidateQueries({ queryKey: ["tasks", workspaceId] });
  };
  const onError = (e: unknown) => toast.error(getErrorMessage(e));

  const add = useMutation({ mutationFn: ({ body, parentId }: { body: string; parentId?: string }) => tasksApi.addComment(workspaceId, taskId, body, parentId), onSuccess: refresh, onError });
  const edit = useMutation({ mutationFn: ({ id, body }: { id: string; body: string }) => tasksApi.editComment(workspaceId, taskId, id, body), onSuccess: () => (setEditing(null), refresh()), onError });
  const remove = useMutation({ mutationFn: (id: string) => tasksApi.removeComment(workspaceId, taskId, id), onSuccess: refresh, onError });
  const react = useMutation({ mutationFn: ({ id, emoji }: { id: string; emoji: string }) => tasksApi.react(workspaceId, taskId, id, emoji), onSuccess: refresh, onError });

  const canComment = can(role, "comments.create");
  const all = comments.data ?? [];
  const roots = all.filter((c) => !c.parentId);
  const replies = (id: string) => all.filter((c) => c.parentId === id);

  const renderComment = (c: Comment, nested = false) => (
    <article key={c.id} className={cn("group flex gap-3", nested && "ml-10")}>
      {c.author ? <UserAvatar user={c.author} className="h-8 w-8 ring-0" /> : <span className="h-8 w-8 rounded-full bg-muted" />}
      <div className="min-w-0 flex-1">
        <header className="flex items-center gap-2 text-sm">
          <span className="font-semibold">{c.author?.name ?? "Conta removida"}</span>
          <time className="text-xs text-muted-foreground" dateTime={c.createdAt} title={new Date(c.createdAt).toLocaleString("pt-BR")}>
            {relativeTime(c.createdAt)}
            {c.editedAt && " · editado"}
          </time>
          {c.body && (c.author?.id === userId || can(role, "members.manage")) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="ml-auto h-6 w-6 opacity-0 group-hover:opacity-100 focus-visible:opacity-100" aria-label="Ações do comentário">
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {c.author?.id === userId && (
                  <DropdownMenuItem onSelect={() => setEditing(c.id)}>
                    <Pencil className="mr-2 h-4 w-4" /> Editar
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem className="text-destructive" onSelect={() => remove.mutate(c.id)}>
                  <Trash2 className="mr-2 h-4 w-4" /> Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </header>
        {editing === c.id ? (
          <div className="mt-1">
            <Composer members={members} initial={c.body} placeholder="Editar comentário" autoFocus pending={edit.isPending} onCancel={() => setEditing(null)} onSubmit={(body) => edit.mutateAsync({ id: c.id, body })} />
          </div>
        ) : c.body ? (
          <MarkdownView value={c.body} className="mt-0.5 text-foreground/90" />
        ) : (
          <p className="mt-0.5 text-sm italic text-muted-foreground">Comentário excluído.</p>
        )}
        {c.body && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            {c.reactions.map((r) => (
              <button
                key={r.emoji}
                disabled={!canComment}
                onClick={() => react.mutate({ id: c.id, emoji: r.emoji })}
                className={cn("flex h-6 items-center gap-1 rounded-full border px-2 text-xs transition-colors hover:border-primary/50", r.mine && "border-primary/50 bg-primary/10")}
                aria-pressed={r.mine}
                aria-label={`${r.emoji} ${r.count}`}
              >
                {r.emoji} <span className="tabular-nums">{r.count}</span>
              </button>
            ))}
            {canComment && (
              <>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6" aria-label="Reagir">
                      <SmilePlus className="h-3.5 w-3.5" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="flex w-auto gap-1 p-1.5">
                    {EMOJIS.map((e) => (
                      <button key={e} className="rounded-md p-1 text-lg hover:bg-accent" onClick={() => react.mutate({ id: c.id, emoji: e })} aria-label={`Reagir com ${e}`}>
                        {e}
                      </button>
                    ))}
                  </PopoverContent>
                </Popover>
                {!nested && (
                  <Button variant="ghost" size="sm" className="h-6 gap-1 px-2 text-xs" onClick={() => setReplyTo(c.id)}>
                    <CornerDownRight className="h-3 w-3" /> Responder
                  </Button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </article>
  );

  return (
    <section aria-label="Comentários" className="space-y-4">
      {comments.isPending ? (
        <Skeleton className="h-16 w-full" />
      ) : roots.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum comentário ainda. Use @ para mencionar alguém.</p>
      ) : (
        roots.map((c) => (
          <div key={c.id} className="space-y-3">
            {renderComment(c)}
            {replies(c.id).map((r) => renderComment(r, true))}
            {replyTo === c.id && (
              <div className="ml-10">
                <Composer members={members} placeholder="Escreva uma resposta…" autoFocus pending={add.isPending} onCancel={() => setReplyTo(null)} onSubmit={(body) => add.mutateAsync({ body, parentId: c.id }).then(() => setReplyTo(null))} />
              </div>
            )}
          </div>
        ))
      )}
      {canComment && <Composer members={members} placeholder="Escreva um comentário… (@ menciona, Ctrl+Enter envia)" pending={add.isPending} onSubmit={(body) => add.mutateAsync({ body })} />}
    </section>
  );
}
