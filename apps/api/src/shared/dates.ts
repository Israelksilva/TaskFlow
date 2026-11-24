/** Normaliza timestamps vindos do driver (Date ou string) para ISO 8601. */
export function toISO(value: Date | string): string {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}
