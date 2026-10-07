// Typed application errors for the JudicialSync service layer.
//
// Service functions throw these instead of leaking raw Prisma/zod errors. The
// thin API route handlers (Y1-api.md §Common Response Envelope) catch them and
// map `code` -> HTTP status, emitting the common envelope
// `{ error: { code, message } }` (Y2-errors.md).

/** Base class so route handlers can `instanceof AppError` and read `.code`/`.httpStatus`. */
export class AppError extends Error {
  readonly code: string;
  readonly httpStatus: number;

  constructor(code: string, message: string, httpStatus: number) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.httpStatus = httpStatus;
    // Restore prototype chain for `instanceof` across transpilation targets.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** 422 — any input validation failure (Y2-errors.md VALIDATION_ERROR). */
export class ValidationError extends AppError {
  constructor(message: string) {
    super('VALIDATION_ERROR', message, 422);
  }
}

/**
 * 409 — a unique-constraint / state conflict. `code` carries the specific
 * conflict (e.g. EXHIBIT_LABEL_CONFLICT) so routes map it directly.
 */
export class ConflictError extends AppError {
  constructor(code: string, message: string) {
    super(code, message, 409);
  }
}

/** 404 — a referenced record does not exist (or is masked). */
export class NotFoundError extends AppError {
  constructor(code: string, message: string) {
    super(code, message, 404);
  }
}
