import {
  AlarmClock,
  AtSign,
  Bell,
  CheckCircle2,
  MessageSquare,
  RotateCcw,
  ShieldCheck,
  Trash2,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import type { AppNotification } from "@andamo/shared";
import { UserAvatar } from "@/components/feedback/UserAvatar";
import { Button } from "@/components/ui/button";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  "task.assigned": UserPlus,
  "task.completed": CheckCircle2,
  "task.reopened": RotateCcw,
  "task.reminder": AlarmClock,
  "task.overdue": AlarmClock,
  mention: AtSign,
  "comment.created": MessageSquare,
  "permission.changed": ShieldCheck,
  "member.joined": UserPlus,
};

export function NotificationItem({
  notification: n,
  onOpen,
  onToggleRead,
  onDelete,
  compact,
}: {
  notification: AppNotification;
  onOpen: (n: AppNotification) => void;
  onToggleRead?: (n: AppNotification) => void;
  onDelete?: (n: AppNotification) => void;
  compact?: boolean;
}) {
  const Icon = ICONS[n.type] ?? Bell;
  const unread = !n.readAt;
  return (
    <div className={cn("group relative flex gap-3 rounded-lg p-2.5 transition-colors hover:bg-accent", unread && "bg-primary/[0.04]")}>
      <div className="relative shrink-0">
        {n.actor ? (
          <UserAvatar user={n.actor} className="h-8 w-8" />
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Icon className="h-4 w-4" aria-hidden />
          </span>
        )}
        {n.actor && (
          <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-card text-primary ring-1 ring-border">
            <Icon className="h-2.5 w-2.5" aria-hidden />
          </span>
        )}
      </div>
      <button className="min-w-0 flex-1 text-left after:absolute after:inset-0" onClick={() => onOpen(n)}>
        <p className={cn("text-sm leading-snug", unread ? "font-semibold" : "text-foreground/90")}>{n.title}</p>
        {n.body && <p className={cn("mt-0.5 text-xs text-muted-foreground", compact ? "line-clamp-1" : "line-clamp-2")}>{n.body}</p>}
        <time className="mt-1 block text-[11px] text-muted-foreground" dateTime={n.createdAt} title={new Date(n.createdAt).toLocaleString("pt-BR")}>
          {relativeTime(n.createdAt)}
        </time>
      </button>
      {unread && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-coral" aria-label="Não lida" />}
      {(onToggleRead || onDelete) && (
        <div className="relative z-10 flex shrink-0 items-start gap-0.5 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
          {onToggleRead && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onToggleRead(n)} aria-label={unread ? "Marcar como lida" : "Marcar como não lida"}>
              <CheckCircle2 className="h-3.5 w-3.5" />
            </Button>
          )}
          {onDelete && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDelete(n)} aria-label="Excluir notificação">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
