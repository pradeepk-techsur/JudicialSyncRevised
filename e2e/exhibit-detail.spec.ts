import { test, expect } from '@playwright/test';

// StatusBadge's enum→label mapping (src/components/StatusBadge.tsx). Both the
// Case Workspace list and this detail screen render status exclusively through
// StatusBadge, so mapping the shared service's raw enum through this table is
// exactly what the UI does — a genuine cross-screen parity check, not a
// re-derivation.
const STATUS_LABEL: Record<string, string> = {
  MARKED: 'Marked',
  OFFERED: 'Offered',
  OBJECTED: 'Objected',
  ADMITTED: 'Admitted',
  EXCLUDED: 'Excluded',
  WITHDRAWN: 'Withdrawn',
};

async function getCaseId(request: any): Promise<string> {
  const caseRes = await request.get('/api/case');
  const { case: kase } = await caseRes.json();
  return kase.id;
}

async function getExhibitRow(
  request: any,
  label: string,
  role = 'JUDGE',
): Promise<{ exhibitId: string; currentStatus: string | null }> {
  const caseId = await getCaseId(request);
  const listRes = await request.get(`/api/cases/${caseId}/exhibits`, {
    headers: { 'X-User-Role': role },
  });
  const rows = await listRes.json();
  const row = rows.find((r: { exhibitLabel: string }) => r.exhibitLabel === label);
  if (!row) throw new Error(`Seed fixture ${label} not found under role ${role}`);
  return { exhibitId: row.exhibitId, currentStatus: row.currentStatus };
}

test.describe('Exhibit Detail View', () => {
  test('header shows status/custodian/party/witness above the fold; full timeline renders in order', async ({ page, request }) => {
    const { exhibitId } = await getExhibitRow(request, 'P-1');
    await page.goto(`/exhibit/${exhibitId}`);
    // Status via the StatusBadge's aria-label — unambiguous vs. the same word
    // appearing inside a timeline summary ("Status changed ... to OBJECTED").
    await expect(page.getByLabel('Current status: Objected')).toBeVisible();
    await expect(page.getByText(/PROSECUTION/)).toBeVisible();
    // P-1's seeded timeline: MARKED, OFFERED, OBJECTION_RAISED, STATUS_CHANGE->OBJECTED = 4 entries, no ruling.
    const entries = page.locator('[aria-label="Exhibit history timeline"] li');
    await expect(entries).toHaveCount(4);
    // Oldest-first: the first entry is the initial MARKED status change.
    await expect(entries.first()).toContainText('Status changed from');
    await expect(entries.first()).toContainText('to MARKED');
  });

  test('a genuinely nonexistent id and a sealed exhibit under an unauthorized role render the identical not-found page', async ({ page, request }) => {
    // Resolve the sealed exhibit's id as JUDGE (who can see it) so we have a
    // real id to probe as an unauthorized role.
    const { exhibitId: sealedId } = await getExhibitRow(request, 'S-1', 'JUDGE');

    // The app's session is pure in-memory zustand (02-05), which resets to the
    // default JUDGE on every full-page navigation — so a UI role switch cannot
    // survive a page.goto. To drive the sealed exhibit's history fetch as an
    // UNAUTHORIZED role deterministically, force X-User-Role=ATTORNEY on the
    // history request itself. ATTORNEY cannot view sealed exhibits, so the
    // route returns the same anti-enumeration 404 a missing id does.
    await page.route('**/api/exhibits/**/history', async (route) => {
      const headers = { ...route.request().headers(), 'x-user-role': 'ATTORNEY' };
      await route.continue({ headers });
    });

    // Compare the MAIN content region (the exhibit-detail render), not the whole
    // body: the app-shell sidebar now carries a role-scoped open-discrepancy count
    // badge (Phase 3), which legitimately differs between the default-JUDGE view
    // and the forced-ATTORNEY view. That ambient chrome is not part of the
    // exhibit-detail anti-enumeration surface — the not-found CONTENT must be
    // byte-identical, and that content lives in <main>.
    const mainContent = page.getByRole('main');

    // Genuinely-missing id (default JUDGE role is fine — the id truly does not exist).
    await page.goto('/exhibit/00000000-0000-0000-0000-000000000000');
    await expect(page.getByText('Exhibit not found')).toBeVisible();
    const missingHtml = await mainContent.innerText();

    // Sealed exhibit, viewed as ATTORNEY (forced above) — must be indistinguishable.
    await page.goto(`/exhibit/${sealedId}`);
    await expect(page.getByText('Exhibit not found')).toBeVisible();
    const sealedHtml = await mainContent.innerText();

    expect(sealedHtml).toBe(missingHtml);
  });

  test('back link returns to /case', async ({ page, request }) => {
    const { exhibitId } = await getExhibitRow(request, 'P-1');
    await page.goto(`/exhibit/${exhibitId}`);
    await page.getByRole('link', { name: /Back to Case Workspace/ }).click();
    await expect(page).toHaveURL(/\/case$/);
  });

  test('F14: acknowledge shows the permanence disclosure + relabeled field before, and the full record after', async ({
    page,
    request,
  }) => {
    // Per plan 07-02's seed no exhibit organically carries an OPEN discrepancy
    // flag (F12 blocks custody-less/open-objection admission). This is a UI-only
    // transparency test, so we mock the two GETs that feed the banner with a
    // forced OPEN flag, and flip them to ACKNOWLEDGED once the acknowledge POST
    // fires — mirroring the page.route mocking pattern used elsewhere in the suite.
    const caseId = await getCaseId(request);
    const caseRes = await request.get('/api/case');
    const { users } = await caseRes.json();
    // The default session role is JUDGE (can acknowledge); use a real JUDGE user
    // id so the client-side name/role resolution off the roster succeeds.
    const judge = users.find((u: { role: string }) => u.role === 'JUDGE');
    expect(judge).toBeTruthy();

    const { exhibitId } = await getExhibitRow(request, 'P-1');
    const RULE = 'ADMITTED_NO_CUSTODIAN';
    const FLAG_ID = 'flag-f14-e2e';
    const JUSTIFICATION = 'Reviewed — custodian will be assigned at recess';

    // Mutable mock state: the flag starts OPEN and flips to ACKNOWLEDGED.
    let acked = false;

    await page.route('**/api/exhibits/**/history', async (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          exhibit: {
            id: exhibitId,
            caseId,
            exhibitLabel: 'P-1',
            description: 'F14 test exhibit',
            offeringParty: 'PROSECUTION',
            associatedWitness: null,
            isSealed: false,
          },
          currentStatus: 'ADMITTED',
          currentCustodianName: null,
          discrepancyFlags: [
            {
              ruleCode: RULE,
              status: acked ? 'ACKNOWLEDGED' : 'OPEN',
              label: 'Admitted without a custodian on record',
            },
          ],
          timeline: [],
        }),
      });
    });

    await page.route('**/api/cases/**/discrepancies', async (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: FLAG_ID,
            caseId,
            exhibitId,
            ruleCode: RULE,
            status: acked ? 'ACKNOWLEDGED' : 'OPEN',
            detectedAt: new Date().toISOString(),
            details: {},
            acknowledgedAt: acked ? new Date().toISOString() : null,
            acknowledgedBy: acked ? judge.id : null,
            resolvedAt: null,
            justification: acked ? JUSTIFICATION : undefined,
          },
        ]),
      });
    });

    await page.route('**/api/discrepancies/*/acknowledge', async (route) => {
      acked = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    });

    await page.goto(`/exhibit/${exhibitId}`);

    // Open the inline acknowledge control.
    await page.getByTestId('exhibit-acknowledge-trigger').first().click();

    // BEFORE confirming: the always-visible permanence disclosure and the
    // relabeled justification field are both present.
    await expect(page.getByTestId('acknowledge-disclosure')).toBeVisible();
    await expect(page.getByTestId('acknowledge-disclosure')).toContainText(
      'recorded as a permanent action under your name and role',
    );
    await expect(
      page.getByLabel(/Justification \(recorded permanently\)/),
    ).toBeVisible();

    // Submit the acknowledgment.
    const textarea = page.getByTestId('acknowledge-textarea').first();
    await textarea.fill(JUSTIFICATION);
    await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/acknowledge') && r.request().method() === 'POST',
      ),
      page.getByTestId('acknowledge-confirm').first().click(),
    ]);

    // AFTER: the full record renders inline — acting user's name + the justification.
    const record = page.getByTestId('discrepancy-ack-record');
    await expect(record).toBeVisible({ timeout: 10000 });
    await expect(record).toContainText(judge.name);
    await expect(record).toContainText(JUSTIFICATION);
  });

  test('cross-screen parity: status shown here matches the shared service the Case Workspace reads', async ({ page, request }) => {
    // Read P-3's status from the SAME service layer the Case Workspace list
    // renders (GET /api/cases/:id/exhibits → ExhibitListRow.currentStatus).
    // The detail screen must show the identical status via StatusBadge.
    const { exhibitId, currentStatus } = await getExhibitRow(request, 'P-3');
    expect(currentStatus).not.toBeNull();
    const expectedLabel = STATUS_LABEL[currentStatus as string];

    await page.goto(`/exhibit/${exhibitId}`);
    await expect(page.getByLabel(`Current status: ${expectedLabel}`)).toBeVisible();
  });
});
