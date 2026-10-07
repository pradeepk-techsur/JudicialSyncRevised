import { NextResponse } from 'next/server';
import { AppError } from '@/lib/errors';

// Maps a thrown error to the common response envelope (Y1-api.md §Common
// Response Envelope): `{ "error": { "code", "message" } }`. Typed AppErrors use
// their own code/httpStatus; anything else becomes a generic 500.
//
// When an AppError carries `details` (e.g. finalize's blocking-exhibit list,
// 03-02), the envelope becomes `{ error: { code, message, details } }`. When
// details is undefined the `details` key is OMITTED entirely — the existing
// bare `{ code, message }` shape is preserved (backward-compatible).
export function errorResponse(err: unknown): NextResponse {
  if (err instanceof AppError) {
    const body =
      err.details !== undefined
        ? { error: { code: err.code, message: err.message, details: err.details } }
        : { error: { code: err.code, message: err.message } };
    return NextResponse.json(body, { status: err.httpStatus });
  }
  return NextResponse.json(
    { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
    { status: 500 },
  );
}
