import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Laptop, Loader2, Smartphone } from "lucide-react";
import { toast } from "sonner";
import type { SessionInfo } from "@andamo/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { InlineError } from "@/components/feedback/InlineError";
import { accountApi } from "@/features/auth/api";
import { getErrorMessage } from "@/lib/api-client";
import { describeUserAgent } from "../user-agent";
import { Section } from "./Section";

export const SESSIONS_KEY = ["account", "sessions"] as const;

const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

function SessionRow({
  session,
  onRevoke,
  pending,
}: {
  session: SessionInfo;
  onRevoke: () => void;
  pending: boolean;
}) {
  const { label, mobile } = describeUserAgent(session.userAgent);
  const Icon = mobile ? Smartphone : Laptop;
  return (
    <li className="flex items-center gap-3 py-3">
      <Icon className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
          {label}
          {session.current && <Badge variant="brand">Esta sessão</Badge>}
        </div>
        <p className="text-xs text-muted-foreground">
          {session.ip ? `${session.ip} · ` : ""}Último uso em{" "}
          {dateTime.format(new Date(session.lastUsedAt))}
        </p>
      </div>
      {!session.current && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onRevoke}
          disabled={pending}
          aria-label={`Encerrar sessão: ${label}`}
        >
          Encerrar
        </Button>
      )}
    </li>
  );
}

export function SessionsSection() {
  const queryClient = useQueryClient();
  const sessions = useQuery({ queryKey: SESSIONS_KEY, queryFn: accountApi.sessions });
  const refresh = () => queryClient.invalidateQueries({ queryKey: SESSIONS_KEY });
  const revoke = useMutation({
    mutationFn: accountApi.revokeSession,
    onSuccess: () => {
      toast.success("Sessão encerrada.");
      void refresh();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  const revokeOthers = useMutation({
    mutationFn: accountApi.revokeOtherSessions,
    onSuccess: ({ revoked }) => {
      toast.success(revoked === 1 ? "1 sessão encerrada." : `${revoked} sessões encerradas.`);
      void refresh();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  const others = sessions.data?.filter((s) => !s.current).length ?? 0;

  return (
    <Section
      title="Sessões ativas"
      description="Dispositivos conectados à sua conta. Encerre os que você não reconhece."
    >
      {sessions.isPending ? (
        <div className="space-y-3" aria-busy="true" aria-label="Carregando sessões">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : sessions.isError ? (
        <InlineError
          action={
            <Button variant="outline" size="sm" onClick={() => void sessions.refetch()}>
              Tentar novamente
            </Button>
          }
        >
          {getErrorMessage(sessions.error)}
        </InlineError>
      ) : (
        <div className="space-y-4">
          <ul className="divide-y">
            {sessions.data.map((s) => (
              <SessionRow
                key={s.id}
                session={s}
                pending={revoke.isPending && revoke.variables === s.id}
                onRevoke={() => revoke.mutate(s.id)}
              />
            ))}
          </ul>
          {others > 0 && (
            <Button
              variant="outline"
              onClick={() => revokeOthers.mutate()}
              disabled={revokeOthers.isPending}
            >
              {revokeOthers.isPending && <Loader2 className="animate-spin" aria-hidden />}
              Encerrar as outras sessões
            </Button>
          )}
        </div>
      )}
    </Section>
  );
}
