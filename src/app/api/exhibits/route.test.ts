import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { POST } from '@/app/api/exhibits/route';
import { GET as getExhibitById } from '@/app/api/exhibits/[id]/route';

// Route-handler tests: import the handlers directly and invoke them with a
// constructed NextRequest — no running server needed. Backed by the real
// Postgres from docker-compose.yml.

async function seedCase() {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const kase = await prisma.case.create({
    data: {
      caseNumber: `TEST-ROUTES-${suffix}`,
      title: 'Routes Test Case',
      court: 'Test Court',
    },
  });
  return { caseId: kase.id, suffix };
}

function postRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/exhibits', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('exhibit API routes', () => {
  let fixture: Awaited<ReturnType<typeof seedCase>>;

  beforeEach(async () => {
    fixture = await seedCase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('POST creates an exhibit (201) and GET /:id fetches it (200)', async () => {
    const { caseId, suffix } = fixture;

    const postRes = await POST(
      postRequest({
        caseId,
        exhibitLabel: `Exhibit ${suffix}`,
        description: 'A sworn affidavit',
        offeringParty: 'PLAINTIFF',
      }),
    );
    expect(postRes.status).toBe(201);
    const created = await postRes.json();
    expect(created.id).toBeTruthy();
    expect(created.exhibitLabel).toBe(`Exhibit ${suffix}`);

    const getRes = await getExhibitById(
      new NextRequest(`http://localhost/api/exhibits/${created.id}`),
      { params: Promise.resolve({ id: created.id }) },
    );
    expect(getRes.status).toBe(200);
    const fetched = await getRes.json();
    expect(fetched.id).toBe(created.id);
  });

  it('POST a duplicate label returns 409 EXHIBIT_LABEL_CONFLICT with the error envelope', async () => {
    const { caseId, suffix } = fixture;
    const label = `Dup ${suffix}`;

    const first = await POST(
      postRequest({ caseId, exhibitLabel: label, description: 'first', offeringParty: 'DEFENSE' }),
    );
    expect(first.status).toBe(201);

    const second = await POST(
      postRequest({ caseId, exhibitLabel: label, description: 'second', offeringParty: 'DEFENSE' }),
    );
    expect(second.status).toBe(409);
    const body = await second.json();
    expect(body.error.code).toBe('EXHIBIT_LABEL_CONFLICT');
    expect(typeof body.error.message).toBe('string');
  });

  it('POST an invalid offeringParty returns 422 VALIDATION_ERROR with the error envelope', async () => {
    const { caseId, suffix } = fixture;

    const res = await POST(
      postRequest({
        caseId,
        exhibitLabel: `Bad ${suffix}`,
        description: 'bad',
        offeringParty: 'WITNESS',
      }),
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(typeof body.error.message).toBe('string');
  });

  it('GET /:id for a nonexistent id returns 404 EXHIBIT_NOT_FOUND with the error envelope', async () => {
    const missingId = '00000000-0000-0000-0000-000000000000';
    const res = await getExhibitById(
      new NextRequest(`http://localhost/api/exhibits/${missingId}`),
      { params: Promise.resolve({ id: missingId }) },
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('EXHIBIT_NOT_FOUND');
    expect(typeof body.error.message).toBe('string');
  });
});
