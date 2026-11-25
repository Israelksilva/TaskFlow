import { addDays, toISODate } from "@andamo/shared";

/** Formata YYYY-MM-DD como "12 de nov." sem conversão de fuso horário. */
export function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const sameYear = y === new Date().getFullYear();
  return date.toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

/** Texto relativo do prazo: "Hoje", "Amanhã", "Ontem" ou a data. */
export function describeDueDate(isoDate: string, today = toISODate()): string {
  if (isoDate === today) return "Hoje";
  if (isoDate === addDays(today, 1)) return "Amanhã";
  if (isoDate === addDays(today, -1)) return "Ontem";
  return formatDate(isoDate);
}

export function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function pluralize(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

const rtf = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });

/** "há 5 minutos", "ontem", "em 3 dias". */
export function relativeTime(iso: string, now = Date.now()): string {
  const diff = (new Date(iso).getTime() - now) / 1000;
  const abs = Math.abs(diff);
  if (abs < 45) return "agora";
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), "day");
  return new Date(iso).toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function formatMinutes(minutes: number | null): string {
  if (!minutes) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h${m ? ` ${m}min` : ""}` : `${m}min`;
}
