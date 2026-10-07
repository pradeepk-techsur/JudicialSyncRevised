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

    // Genuinely-missing id (default JUDGE role is fine — the id truly does not exist).
    await page.goto('/exhibit/00000000-0000-0000-0000-000000000000');
    await expect(page.getByText('Exhibit not found')).toBeVisible();
    const missingHtml = await page.locator('body').innerText();

    // Sealed exhibit, viewed as ATTORNEY (forced above) — must be indistinguishable.
    await page.goto(`/exhibit/${sealedId}`);
    await expect(page.getByText('Exhibit not found')).toBeVisible();
    const sealedHtml = await page.locator('body').innerText();

    expect(sealedHtml).toBe(missingHtml);
  });

  test('back link returns to /case', async ({ page, request }) => {
    const { exhibitId } = await getExhibitRow(request, 'P-1');
    await page.goto(`/exhibit/${exhibitId}`);
    await page.getByRole('link', { name: /Back to Case Workspace/ }).click();
    await expect(page).toHaveURL(/\/case$/);
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
