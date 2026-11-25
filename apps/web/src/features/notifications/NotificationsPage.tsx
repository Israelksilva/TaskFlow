import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BellOff, CheckCheck, Loader2, Settings } from "lucide-react";
import { NOTIFICATION_CATEGORIES, NOTIFICATION_CATEGORY_LABELS, type AppNotification } from "@andamo/shared";
import { EmptyState } from "@/components/feedback/EmptyState";
import { InlineError } from "@/components/feedback/InlineError";
import { useCrumbs } from "@/components/layout/AppHeader";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getErrorMessage } from "@/lib/api-client";
import { NotificationItem } from "./components/NotificationItem";
import { useNotificationActions, useNotifications, useUnreadCount } from "./hooks";

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(Date.now() - 864e5);
  if (d.toDateString() === today.toDateString()) return "Hoje";
  if (d.toDateString() === yesterday.toDateString()) return "Ontem";
  return d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [category, setCategory] = useState("all");
  const list = useNotifications(filter, category === "all" ? undefined : category);
  const unread = useUnreadCount().data ?? 0;
  const { markRead, markAll, remove } = useNotificationActions();
  useCrumbs([{ label: "Caixa de entrada" }]);

  const items = list.data?.pages.flatMap((p) => p.items) ?? [];
  const groups = items.reduce<Array<{ day: string; items: AppNotification[] }>>((acc, n) => {
    const day = dayLabel(n.createdAt);
    const last = acc[acc.length - 1];
    if (last?.day === day) last.items.push(n);
    else acc.push({ day, items: [n] });
    return acc;
  }, []);

  const open = (n: AppNotification) => {
    if (!n.readAt) markRead.mutate({ id: n.id, read: true });
    if (n.link) navigate(n.link);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-6 lg:py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">Caixa de entrada</h1>
          <p className="mt-1 text-sm text-muted-foreground">{unread ? `${unread} não lida(s)` : "Tudo lido."} Atribuições, menções, prazos e avisos do seu time.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={!unread || markAll.isPending} onClick={() => markAll.mutate()}>
            <CheckCheck /> Marcar todas como lidas
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link to="/app/configuracoes/notificacoes"><Settings /> Preferências</Link>
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <TabsList>
            <TabsTrigger value="all">Todas</TabsTrigger>
            <TabsTrigger value="unread">Não lidas</TabsTrigger>
          </TabsList>
        </Tabs>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="h-9 w-48" aria-label="Categoria"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {NOTIFICATION_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{NOTIFICATION_CATEGORY_LABELS[c]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {list.isError && <InlineError>{getErrorMessage(list.error)}</InlineError>}
      {list.isPending ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : !items.length ? (
        <EmptyState icon={BellOff} title={filter === "unread" ? "Nenhuma notificação não lida" : "Nenhuma notificação"} description="Quando algo acontecer com você ou com tarefas que você segue, aparece aqui." />
      ) : (
        groups.map((g) => (
          <section key={g.day} aria-label={g.day}>
            <h2 className="mb-1 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground first-letter:uppercase">{g.day}</h2>
            <div className="rounded-xl border bg-card p-1.5 shadow-card">
              {g.items.map((n) => (
                <NotificationItem
                  key={n.id}
                  notification={n}
                  onOpen={open}
                  onToggleRead={(x) => markRead.mutate({ id: x.id, read: !x.readAt })}
                  onDelete={(x) => remove.mutate(x.id)}
                />
              ))}
            </div>
          </section>
        ))
      )}
      {list.hasNextPage && (
        <div className="flex justify-center">
          <Button variant="outline" disabled={list.isFetchingNextPage} onClick={() => void list.fetchNextPage()}>
            {list.isFetchingNextPage && <Loader2 className="animate-spin" />} Carregar mais
          </Button>
        </div>
      )}
    </div>
  );
}
