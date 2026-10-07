// Typed application errors for the JudicialSync service layer.
//
// Service functions throw these instead of leaking raw Prisma/zod errors. The
// thin API route handlers (Y1-api.md §Common Response Envelope) catch them and
// map `code` -> HTTP status, emitting the common envelope
// `{ error: { code, message } }` (Y2-errors.md).

/**
 * Base class so route handlers can `instanceof AppError` and read `.code`/`.httpStatus`.
 *
 * `details` is an OPTIONAL structured payload surfaced by `errorResponse` as
 * `{ error: { code, message, details } }` when present (omitted entirely when
 * undefined — fully backward-compatible with the bare `{ code, message }`
 * envelope). This is the channel finalize's 409 blocking-exhibit list rides on
 * (plan 03-02); it is provided here in wave 1 so downstream only consumes it.
 */
export class AppError extends Error {
  readonly code: string;
  readonly httpStatus: number;
  readonly details?: unknown;

  constructor(code: string, message: string, httpStatus: number, details?: unknown) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.httpStatus = httpStatus;
    this.details = details;
    // Restore prototype chain for `instanceof` across transpilation targets.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** 422 — any input validation failure (Y2-errors.md VALIDATION_ERROR). */
export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super('VALIDATION_ERROR', message, 422, details);
  }
}

/**
 * 409 — a unique-constraint / state conflict. `code` carries the specific
 * conflict (e.g. EXHIBIT_LABEL_CONFLICT) so routes map it directly.
 */
export class ConflictError extends AppError {
  constructor(code: string, message: string, details?: unknown) {
    super(code, message, 409, details);
  }
}

/** 404 — a referenced record does not exist (or is masked). */
export class NotFoundError extends AppError {
  constructor(code: string, message: string, details?: unknown) {
    super(code, message, 404, details);
  }
}

/**
 * 422 — a semantically-invalid request that carries a more specific code than
 * the generic VALIDATION_ERROR (e.g. INVALID_STATUS_TRANSITION). Same HTTP
 * status as ValidationError, but preserves the feature-specific error code so
 * the client can distinguish it (Y2-errors.md).
 */
export class UnprocessableError extends AppError {
  constructor(code: string, message: string, details?: unknown) {
    super(code, message, 422, details);
  }
}

/**
 * 403 — ROLE_NOT_PERMITTED. The acting user's role is not authorized for this
 * action. Shared by the discrepancy/jury features (acknowledgeDiscrepancy
 * role-gate, F6; finalize, 03-02). objections.ts keeps its own private
 * ruling-specific variant — this is the general-purpose one.
 */
export class RoleNotPermittedError extends AppError {
  constructor(message = 'You are not permitted to perform this action', details?: unknown) {
    super('ROLE_NOT_PERMITTED', message, 403, details);
  }
}

/**
 * 503 — the LLM provider is unreachable, timed out, or no API key is configured.
 * This is strictly an ERROR/TRANSPORT outcome — it MUST surface on the HTTP 503
 * channel and be rendered as the distinct "temporarily unavailable" system
 * notice, NEVER as assistant message text and NEVER as a Decline (ROADMAP
 * criterion 5; Y2-errors.md §Assistant).
 */
export class AssistantUnavailableError extends AppError {
  constructor(message = 'The assistant is temporarily unavailable — please try again') {
    super('ASSISTANT_UNAVAILABLE', message, 503);
  }
}

/**
 * Tool-level validation failure (NOT an HTTP error). A tool wrapper throws/returns
 * this when its zod arg schema rejects the model's arguments; it is surfaced back
 * to the MODEL within the same turn (so it can retry with corrected args), never
 * to the end user as an HTTP status (Y2-errors.md §Assistant TOOL_ARGS_INVALID).
 * httpStatus 422 is a sane default for the rare case it does leak to a route.
 */
export class ToolArgsInvalidError extends AppError {
  constructor(toolName: string, detail: string) {
    super('TOOL_ARGS_INVALID', `Invalid arguments for tool ${toolName}: ${detail}`, 422);
  }
}

/**
 * 500 — any underlying service query failure while composing the Command Center
 * activity feed (FRD F08 §Error States: "Unable to load trial activity — please
 * retry"). Thrown by the /activity route when getRecentActivity fails for a
 * reason that is not a client-input problem (those stay 422 VALIDATION_ERROR).
 */
export class CommandCenterLoadError extends AppError {
  constructor() {
    super(
      'COMMAND_CENTER_LOAD_FAILED',
      'Unable to load trial activity — please retry',
      500,
    );
  }
}
