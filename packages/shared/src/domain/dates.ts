/** Retorna a data local no formato YYYY-MM-DD. */
export function toISODate(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Soma (ou subtrai) dias a uma data YYYY-MM-DD. */
export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return toISODate(new Date(y, m - 1, d + days));
}
