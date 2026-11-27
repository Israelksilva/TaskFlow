import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Info, Megaphone, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { supportApi } from "./api";

const DISMISSED = "andamo:avisos-dispensados";

function readDismissed(): string[] {
  try {
    return JSON.parse(localStorage.getItem(DISMISSED) ?? "[]") as string[];
  } catch {
    return [];
  }
}

/** Avisos globais da administração (manutenção, novidades). Avisos críticos não podem ser dispensados. */
export function AnnouncementBanner() {
  const { data } = useQuery({ queryKey: ["announcements"], queryFn: supportApi.announcements, staleTime: 5 * 60_000, refetchInterval: 10 * 60_000 });
  const [dismissed, setDismissed] = useState(readDismissed);
  const visible = (data ?? []).filter((a) => a.level === "critical" || !dismissed.includes(a.id));
  if (!visible.length) return null;
  const dismiss = (id: string) => {
    const next = [...dismissed, id].slice(-50);
    setDismissed(next);
    try {
      localStorage.setItem(DISMISSED, JSON.stringify(next));
    } catch {
      /* armazenamento indisponível: some só nesta sessão */
    }
  };
  return (
    <div className="print:hidden">
      {visible.map((a) => {
        const Icon = a.level === "critical" ? AlertTriangle : a.level === "warning" ? Megaphone : Info;
        return (
          <div
            key={a.id}
            role={a.level === "critical" ? "alert" : "status"}
            className={cn(
              "flex items-start gap-3 border-b px-4 py-2 text-sm sm:px-6",
              a.level === "critical" ? "bg-destructive/10 text-destructive" : a.level === "warning" ? "bg-warning/10" : "bg-primary/5",
            )}
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <p className="min-w-0 flex-1">
              <strong className="font-semibold">{a.title}</strong>
              {a.body && <span className="text-muted-foreground"> — {a.body}</span>}
            </p>
            {a.level !== "critical" && (
              <button onClick={() => dismiss(a.id)} className="rounded p-0.5 opacity-70 hover:opacity-100" aria-label="Dispensar aviso">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
