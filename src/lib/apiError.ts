import { NextResponse } from 'next/server';
import { AppError } from '@/lib/errors';

// Maps a thrown error to the common response envelope (Y1-api.md §Common
// Response Envelope): `{ "error": { "code", "message" } }`. Typed AppErrors use
// their own code/httpStatus; anything else becomes a generic 500.
export function errorResponse(err: unknown): NextResponse {
  if (err instanceof AppError) {
    return NextResponse.json(
      { error: { code: err.code, message: err.message } },
      { status: err.httpStatus },
    );
  }
  return NextResponse.json(
    { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
    { status: 500 },
  );
}
