import { useState } from "react";
import { Link } from "react-router-dom";
import { Bell, CheckCheck } from "lucide-react";
import type { AppNotification } from "@andamo/shared";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { useNotificationActions, useNotifications, useUnreadCount } from "../hooks";
import { NotificationItem } from "./NotificationItem";

export function NotificationBell({ onOpen }: { onOpen: (n: AppNotification) => void }) {
  const [open, setOpen] = useState(false);
  const unread = useUnreadCount().data ?? 0;
  const list = useNotifications("all");
  const { markAll } = useNotificationActions();
  const items = list.data?.pages.flatMap((p) => p.items).slice(0, 8) ?? [];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9" aria-label={unread ? `Notificações: ${unread} não lidas` : "Notificações"}>
          <Bell className="h-[18px] w-[18px]" />
          {unread > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 animate-pop-in items-center justify-center rounded-full bg-coral px-1 text-[10px] font-bold text-white ring-2 ring-card">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(92vw,380px)] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="font-semibold">Notificações</p>
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" disabled={!unread || markAll.isPending} onClick={() => markAll.mutate()}>
            <CheckCheck className="h-3.5 w-3.5" /> Marcar todas como lidas
          </Button>
        </div>
        <div className="scrollbar-thin max-h-[420px] overflow-y-auto p-2">
          {list.isPending ? (
            Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="mb-2 h-14 w-full" />)
          ) : items.length === 0 ? (
            <p className="px-3 py-10 text-center text-sm text-muted-foreground">Tudo em dia! Nenhuma notificação por aqui.</p>
          ) : (
            items.map((n) => (
              <NotificationItem
                key={n.id}
                notification={n}
                compact
                onOpen={(item) => {
                  setOpen(false);
                  onOpen(item);
                }}
              />
            ))
          )}
        </div>
        <div className="border-t p-2">
          <Button asChild variant="ghost" className="w-full text-sm" onClick={() => setOpen(false)}>
            <Link to="/app/notificacoes">Ver todas as notificações</Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
