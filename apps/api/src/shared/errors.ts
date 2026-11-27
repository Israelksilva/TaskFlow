/** Erro de aplicação com status HTTP e código estável para o cliente. */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, string[]>,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class BadRequestError extends AppError {
  constructor(message = "Requisição inválida", code = "BAD_REQUEST") {
    super(400, code, message);
  }
}

export class ValidationError extends AppError {
  constructor(details: Record<string, string[]>, message = "Dados inválidos") {
    super(422, "VALIDATION_ERROR", message, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Não autenticado", code = "UNAUTHORIZED") {
    super(401, code, message);
  }
}

export class NotFoundError extends AppError {
  constructor(resource = "Recurso") {
    super(404, "NOT_FOUND", `${resource} não encontrado(a)`);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, code = "CONFLICT") {
    super(409, code, message);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = "Muitas tentativas. Tente novamente mais tarde.", code = "TOO_MANY_REQUESTS") {
    super(429, code, message);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message: string, code = "SERVICE_UNAVAILABLE") {
    super(503, code, message);
  }
}
