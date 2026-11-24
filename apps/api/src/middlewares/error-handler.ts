import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import type { ApiErrorBody } from "@andamo/shared";
import { AppError, ConflictError, ValidationError } from "../shared/errors";
import { formatZodError } from "../shared/validation";

export const notFoundHandler: RequestHandler = (req) => {
  throw new AppError(404, "ROUTE_NOT_FOUND", `Rota ${req.method} ${req.path} não encontrada`);
};

/** Códigos SQLSTATE do PostgreSQL que viram respostas 4xx. */
const PG_ERRORS: Record<string, () => AppError> = {
  "23505": () => new ConflictError("Registro duplicado"), // unique_violation
  "23514": () => new AppError(422, "VALIDATION_ERROR", "Dados inválidos"), // check_violation
  "22P02": () => new AppError(400, "BAD_REQUEST", "Formato de dado inválido"), // invalid_text_representation
  "22001": () => new AppError(422, "VALIDATION_ERROR", "Texto maior que o permitido"), // string_data_right_truncation
};

function normalizeError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof ZodError) return new ValidationError(formatZodError(error));

  if (error && typeof error === "object") {
    const { code, type } = error as { code?: unknown; type?: unknown };
    if (typeof code === "string" && PG_ERRORS[code]) return PG_ERRORS[code]();

    // Erros do body-parser do Express
    if (type === "entity.parse.failed") return new AppError(400, "INVALID_JSON", "JSON malformado");
    if (type === "entity.too.large") {
      return new AppError(413, "PAYLOAD_TOO_LARGE", "Corpo da requisição muito grande");
    }
  }

  return new AppError(500, "INTERNAL_ERROR", "Erro interno do servidor");
}

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  const appError = normalizeError(error);

  if (appError.statusCode >= 500) req.log?.error({ err: error }, "Erro não tratado");

  const body: ApiErrorBody = {
    error: {
      code: appError.code,
      message: appError.message,
      ...(appError.details && { details: appError.details }),
    },
  };
  res.status(appError.statusCode).json(body);
};
