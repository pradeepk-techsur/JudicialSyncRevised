import { NextResponse, type NextRequest } from 'next/server';
import { createExhibit } from '@/services/exhibits';
import { ValidationError } from '@/lib/errors';
import { errorResponse } from '@/lib/apiError';

// POST /api/exhibits — create an exhibit identity record (F0, Y1-api.md §Exhibits).
// Thin wrapper: parse body, call exactly one service function, shape the response.
// No business logic here (validation/conflict handling live in the service).
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ValidationError('request body must be valid JSON');
    }

    const exhibit = await createExhibit(body as Parameters<typeof createExhibit>[0]);
    return NextResponse.json(exhibit, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
