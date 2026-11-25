import type { ZodError, ZodType, z } from "zod";
import { ValidationError } from "./errors";

/** Converte um ZodError em `{ campo: [mensagens] }`. Erros de raiz ficam em `_root`. */
export function formatZodError(error: ZodError): Record<string, string[]> {
  const details: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.length ? issue.path.join(".") : "_root";
    (details[key] ??= []).push(issue.message);
  }
  return details;
}

/** Valida `data` com o schema e lança `ValidationError` (422) em caso de falha. */
export function parse<S extends ZodType>(schema: S, data: unknown): z.output<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const details = formatZodError(result.error);
    const message = details._root?.[0] ?? "Dados inválidos";
    throw new ValidationError(details, message);
  }
  return result.data;
}
