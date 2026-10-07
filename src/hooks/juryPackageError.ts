// Shared error envelope + parser for the jury-package / discrepancy mutation
// hooks. Extracted so both useJuryPackage (query + mutations) and the standalone
// useAcknowledgeDiscrepancy mutation can reuse them WITHOUT the latter importing
// the former (which would drag in the jury-package query/poll — W3).

// An entry in the finalize 409's blocking-exhibit list (error.details) surfaced
// by the server so the Draft view can name the blockers inline (ROADMAP crit 3).
export interface BlockingExhibit {
  exhibitId: string;
  exhibitLabel: string;
  ruleCodes: string[];
}

// A typed error carrying the parsed server error envelope so callers can branch
// on the code (e.g. JURY_PACKAGE_DISCREPANCIES_OPEN) and read details.
export class JuryPackageError extends Error {
  code: string;
  details?: { blockingExhibits?: BlockingExhibit[] };
  status: number;
  constructor(
    code: string,
    message: string,
    status: number,
    details?: { blockingExhibits?: BlockingExhibit[] },
  ) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export async function parseError(res: Response): Promise<JuryPackageError> {
  let body: { error?: { code?: string; message?: string; details?: unknown } } = {};
  try {
    body = await res.json();
  } catch {
    /* non-JSON error body */
  }
  const code = body.error?.code ?? 'UNKNOWN_ERROR';
  const message = body.error?.message ?? `Request failed (${res.status})`;
  const details = body.error?.details as { blockingExhibits?: BlockingExhibit[] } | undefined;
  return new JuryPackageError(code, message, res.status, details);
}
