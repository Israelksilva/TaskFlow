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
