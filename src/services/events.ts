import type { EventType, ExhibitEvent, Prisma, PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { ValidationError } from '@/lib/errors';
import { eventPayloadSchemas } from '@/lib/validation/eventPayloads';

// A Prisma client OR an interactive-transaction client — recordEvent accepts
// either, so callers that must atomically write a ledger row AND update a
// projection (e.g. custody transfer) can pass their own `tx` and keep both
// writes in one transaction. Omitted → recordEvent opens its own transaction.
type PrismaLike = PrismaClient | Prisma.TransactionClient;

// recordEvent is the SINGLE append-only ledger writer for the entire codebase.
// Every later feature (status, objections, custody, discrepancies) records
// history by calling this function — never by calling prisma.exhibitEvent.create
// directly. This is the architectural linchpin: if any other path could write an
// ExhibitEvent row, replayability, citation trustworthiness, and projection
// consistency would all be undermined. Enforced by convention + the grep check
// in the plan's done criteria (exactly one exhibitEvent.create call site, here).

export async function recordEvent(
  args: {
    exhibitId: string;
    eventType: EventType;
    payload: unknown;
    actorUserId: string;
    recordedAt?: Date; // seed-only override; live callers omit this and get new Date()
  },
  client?: PrismaLike,
): Promise<ExhibitEvent> {
  const { exhibitId, eventType, payload, actorUserId, recordedAt } = args;

  // 1. Validate the payload shape against the schema for this eventType BEFORE
  //    opening the transaction — a malformed ledger row never reaches the DB.
  const schema = eventPayloadSchemas[eventType];
  if (!schema) {
    throw new ValidationError(`eventType must be a known EventType (got "${eventType}")`);
  }

  let validatedPayload: unknown;
  try {
    validatedPayload = schema.parse(payload);
  } catch (err) {
    if (err instanceof z.ZodError) {
      const first = err.issues[0];
      const field = first?.path.join('.') || 'payload';
      throw new ValidationError(`${field} ${first?.message ?? 'is invalid'}`);
    }
    throw err;
  }

  // 2. Inside a single transaction: resolve the exhibit's caseId, compute the
  //    next per-exhibit sequenceNo, then append the row. The transaction keeps
  //    the max-read and the insert atomic for a single writer.
  //
  //    When a caller supplies its own transaction client, run the append inside
  //    THAT transaction so the ledger write composes atomically with whatever
  //    the caller does alongside it (e.g. a projection upsert). Otherwise open
  //    our own transaction.
  const write = async (tx: PrismaLike): Promise<ExhibitEvent> => {
    const exhibit = await tx.exhibit.findUnique({
      where: { id: exhibitId },
      select: { caseId: true },
    });
    if (!exhibit) {
      throw new ValidationError(`exhibitId must reference an existing exhibit (got "${exhibitId}")`);
    }

    const agg = await tx.exhibitEvent.aggregate({
      where: { exhibitId },
      _max: { sequenceNo: true },
    });
    const sequenceNo = (agg._max.sequenceNo ?? 0) + 1;

    return tx.exhibitEvent.create({
      data: {
        exhibitId,
        caseId: exhibit.caseId,
        eventType,
        payload: validatedPayload as object,
        actorUserId,
        sequenceNo,
        recordedAt: recordedAt ?? new Date(),
      },
    });
  };

  if (client) {
    return write(client);
  }
  return prisma.$transaction((tx) => write(tx));
}
