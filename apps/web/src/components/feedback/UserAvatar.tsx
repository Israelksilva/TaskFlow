import type { UserSummary } from "@andamo/shared";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getInitials } from "@/lib/format";
import { cn } from "@/lib/utils";

const HUES = [247, 271, 14, 199, 152, 330, 38];

/** Cor estável por usuário (derivada do id), para avatares sem foto. */
function hueFor(id: string) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return HUES[h % HUES.length];
}

export function UserAvatar({ user, className, tooltip = false }: { user: UserSummary; className?: string; tooltip?: boolean }) {
  const hue = hueFor(user.id);
  const avatar = (
    <Avatar className={cn("h-7 w-7 ring-2 ring-card", className)}>
      {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt="" referrerPolicy="no-referrer" />}
      <AvatarFallback
        className="text-[11px] font-semibold text-white"
        style={{ background: `linear-gradient(135deg, hsl(${hue} 70% 58%), hsl(${(hue + 30) % 360} 70% 52%))` }}
      >
        {getInitials(user.name)}
      </AvatarFallback>
    </Avatar>
  );
  if (!tooltip) return avatar;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">{avatar}</span>
      </TooltipTrigger>
      <TooltipContent>{user.name}</TooltipContent>
    </Tooltip>
  );
}

export function AvatarStack({ users, max = 3, className }: { users: UserSummary[]; max?: number; className?: string }) {
  if (!users.length) return null;
  return (
    <span className={cn("flex -space-x-1.5", className)}>
      {users.slice(0, max).map((u) => (
        <UserAvatar key={u.id} user={u} tooltip className="h-6 w-6" />
      ))}
      {users.length > max && (
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px] font-semibold ring-2 ring-card">
          +{users.length - max}
        </span>
      )}
    </span>
  );
}
