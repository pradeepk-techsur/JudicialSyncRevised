import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

// F8 — Trial Command Center E2E. Proves all three ROADMAP criteria end-to-end,
// plus sealed absence, per-panel error isolation, and link-through.
//
// Conventions (mirrors case-workspace/exhibit-detail specs): the app session is
// pure in-memory zustand that resets to the default JUDGE on every full
// navigation, so role is forced per-request via page.route X-User-Role header
// injection; ids are resolved through /api/case + /api/cases/:id/exhibits;
// assertions key on text signatures, not brittle indices. workers:1 + baseURL
// come from playwright.config.ts.

// First valid next transition for a given status (mirrors
// src/services/status.ts ALLOWED_TRANSITIONS) — lets Test 4 pick a VALID
// state-machine move regardless of seed drift across re-runs.
const NEXT_TRANSITION: Record<string, string | undefined> = {
  MARKED: 'OFFERED',
  OFFERED: 'ADMITTED',
  OBJECTED: 'ADMITTED',
};

async function getCaseId(request: APIRequestContext): Promise<string> {
  const res = await request.get('/api/case');
  const { case: kase } = await res.json();
  return kase.id;
}

async function getJudgeId(request: APIRequestContext): Promise<string> {
  const res = await request.get('/api/case');
  const { users } = await res.json();
  const judge = users.find((u: { role: string }) => u.role === 'JUDGE');
  if (!judge) throw new Error('No JUDGE in seed roster');
  return judge.id;
}

async function getExhibits(
  request: APIRequestContext,
  role = 'JUDGE',
): Promise<Array<{ exhibitId: string; exhibitLabel: string; currentStatus: string | null }>> {
  const caseId = await getCaseId(request);
  const res = await request.get(`/api/cases/${caseId}/exhibits`, {
    headers: { 'X-User-Role': role },
  });
  return res.json();
}

// Force every case-scoped API request this page issues to carry a given role —
// the whole Command Center (all three panels + the jury-package draft check +
// the exhibit-list intersection) then loads AS that role.
async function forceRole(page: Page, role: string): Promise<void> {
  await page.route('**/api/case', async (route) => {
    await route.continue({ headers: { ...route.request().headers(), 'x-user-role': role } });
  });
  await page.route('**/api/cases/**', async (route) => {
    await route.continue({ headers: { ...route.request().headers(), 'x-user-role': role } });
  });
}

test.describe('Trial Command Center', () => {
  // Criterion 1 — opens with no setup, three populated panels + freshness.
  test('opens with zero config showing the three panels and the freshness indicator', async ({
    page,
  }) => {
    await page.goto('/command-center');

    await expect(page.getByRole('heading', { name: /recent activity/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /unresolved objections/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /discrepancies/i })).toBeVisible();

    // Recent Activity has ≥1 row (the seed has events; the latest-trial-day
    // window guarantees population).
    const rows = page.getByTestId('recent-activity-row');
    await expect(rows.first()).toBeVisible();
    expect(await rows.count()).toBeGreaterThanOrEqual(1);

    // Freshness indicator renders.
    await expect(page.getByTestId('freshness-indicator')).toContainText(/updated .* ago|updating/i);
  });

  // Criterion 1 — default landing + sidebar (non-regression on Jury/Assistant).
  test('/ redirects to /command-center and the sidebar shows Command Center first', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/command-center$/);

    const nav = page.getByRole('navigation', { name: /main navigation/i });
    const links = nav.getByRole('link');
    // First nav item is Command Center.
    await expect(links.first()).toHaveText(/command center/i);
    // Non-regression: Case Workspace, Jury Package, Assistant all survive the
    // additive edit.
    await expect(nav.getByRole('link', { name: /case workspace/i })).toBeVisible();
    await expect(nav.getByRole('link', { name: /jury package/i })).toBeVisible();
    await expect(nav.getByRole('link', { name: /assistant/i })).toBeVisible();
  });

  // Criterion 3 — strictly read-only: no write affordances, link-through only.
  test('exposes no record/edit/acknowledge path — link-through only', async ({ page }) => {
    await page.goto('/command-center');
    const cc = page.getByTestId('command-center');
    // Wait for the panels to settle into their loaded (happy-path) render.
    await expect(page.getByTestId('recent-activity-row').first()).toBeVisible();

    // No mutating input surfaces anywhere on the screen.
    await expect(cc.locator('form')).toHaveCount(0);
    await expect(cc.locator('input')).toHaveCount(0);
    await expect(cc.locator('textarea')).toHaveCount(0);

    // No mutation-named controls (a read-only "retry" on an errored panel would
    // be acceptable, but on the happy path there are none).
    await expect(
      cc.getByRole('button', { name: /record|edit|acknowledge|save|submit|resolve|add/i }),
    ).toHaveCount(0);

    // Every actionable Recent Activity element is a link into Exhibit Detail.
    const firstRow = page.getByTestId('recent-activity-row').first();
    await expect(firstRow).toHaveAttribute('href', /\/exhibit\//);
  });

  // Criterion 2 — a new event recorded elsewhere appears within one 4s interval.
  test('a new event recorded in another tab appears within one polling interval, no reload', async ({
    context,
    request,
  }) => {
    const judgeId = await getJudgeId(request);
    const exhibits = await getExhibits(request, 'JUDGE');
    // Target P-5 specifically — it is referenced by NO other E2E suite, so the
    // single real write this test performs can never perturb another spec's
    // seeded-status assertions (P-1/P-2/P-3/D-1/S-1 are all asserted elsewhere).
    // Compute its valid next transition dynamically (MARKED→OFFERED on a fresh
    // seed) so the test survives a prior run that already advanced it.
    const candidate = exhibits.find((e) => e.exhibitLabel === 'P-5');
    if (!candidate) throw new Error('Seed fixture P-5 not found');
    const toStatus = candidate.currentStatus
      ? NEXT_TRANSITION[candidate.currentStatus]
      : undefined;
    // If P-5 has already been advanced to a terminal status by a prior run,
    // there is nothing valid to record — skip rather than violate the state
    // machine (re-seed to restore a clean MARKED P-5).
    test.skip(!toStatus, 'P-5 has no valid next transition (already advanced)');
    const nextStatus = toStatus as string;

    // Tab A: open the Command Center and let it settle.
    const tabA = await context.newPage();
    await tabA.goto('/command-center');
    await expect(tabA.getByTestId('recent-activity-row').first()).toBeVisible();

    // Tab B / request: record a new status-change event (a guaranteed new ledger
    // event) WITHOUT touching tab A.
    const res = await request.post(`/api/exhibits/${candidate.exhibitId}/events/status`, {
      headers: { 'X-User-Role': 'JUDGE', 'Content-Type': 'application/json' },
      data: { toStatus: nextStatus, actorUserId: judgeId },
    });
    expect(res.ok()).toBeTruthy();

    // Back on tab A, without reloading, the new event's status signature appears
    // within one 4s interval (+ margin). The summarizer renders
    // "Status changed from X to <toStatus>".
    await expect(tabA.getByTestId('recent-activity-list')).toContainText(
      new RegExp(`to ${nextStatus}`),
      { timeout: 6_000 },
    );
    await tabA.close();
  });

  // Sealed absence across all three panels + counts for an unauthorized role.
  test('sealed exhibit S-1 is absent from every panel as ATTORNEY, with no redacted indicator', async ({
    page,
    request,
  }) => {
    // Confirm S-1 exists + is sealed (visible to JUDGE, absent to ATTORNEY).
    const asJudge = await getExhibits(request, 'JUDGE');
    expect(asJudge.some((e) => e.exhibitLabel === 'S-1')).toBeTruthy();
    const asAttorney = await getExhibits(request, 'ATTORNEY');
    expect(asAttorney.some((e) => e.exhibitLabel === 'S-1')).toBeFalsy();

    await forceRole(page, 'ATTORNEY');
    await page.goto('/command-center');
    await expect(page.getByTestId('command-center')).toBeVisible();
    // Let the panels finish their first fetch under the forced role.
    await expect(page.getByRole('heading', { name: /recent activity/i })).toBeVisible();

    // S-1 appears nowhere, and there is no "hidden/redacted/sealed" indicator.
    await expect(page.getByText('S-1')).toHaveCount(0);
    await expect(page.getByText(/hidden|redacted|sealed/i)).toHaveCount(0);
  });

  // Per-panel error isolation — one panel's 500 never blanks the others.
  test('a discrepancies 500 shows only that panel inline error; the other two still render', async ({
    page,
  }) => {
    await page.route('**/api/cases/**/discrepancies', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'x' } }),
      });
    });

    await page.goto('/command-center');

    // Discrepancies panel shows its own inline error.
    const disc = page.getByTestId('discrepancies-panel');
    await expect(disc.getByText(/unable to load|retry/i)).toBeVisible();

    // The other two panels are NOT blanked: Recent Activity still has rows and
    // Objections still renders its header.
    await expect(page.getByTestId('recent-activity-row').first()).toBeVisible();
    await expect(
      page.getByTestId('objections-panel').getByRole('heading', { name: /unresolved objections/i }),
    ).toBeVisible();
  });

  // F15 — every Recent Activity row shows a full date+time and its exhibit label.
  test('every Recent Activity row shows a full date+time and its exhibit label', async ({ page }) => {
    await page.goto('/command-center');
    const rows = page.getByTestId('recent-activity-row');
    await expect(rows.first()).toBeVisible();
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(1);
    for (let i = 0; i < count; i++) {
      const text = await rows.nth(i).innerText();
      // A full date+time stamp includes a 4-digit year — a time-only stamp
      // ("2:14 PM") does not. This is the discriminating assertion.
      expect(text).toMatch(/\b\d{4}\b/);
      // Every row's rendered text includes a seeded exhibit label prefix
      // (P-/D-/S- followed by a digit).
      expect(text).toMatch(/\b[PDS]-\d+\b/);
    }
  });

  // Link-through (Phase 4 deep-link) — a Recent Activity row navigates to Exhibit
  // Detail with the timeline rendered.
  test('a Recent Activity row links through to Exhibit Detail with the timeline', async ({
    page,
  }) => {
    await page.goto('/command-center');
    const firstRow = page.getByTestId('recent-activity-row').first();
    await expect(firstRow).toBeVisible();
    await firstRow.click();

    await expect(page).toHaveURL(/\/exhibit\/.+/);
    await expect(page.locator('[aria-label="Exhibit history timeline"]')).toBeVisible();
  });

  // ===================================================================
  // 08-10 — stat cards, distribution bar, custody panel, filter pills,
  // date grouping, and the page-local screen header.
  // ===================================================================

  // A deterministic activity payload (feed + statusCounts) so the stat-card and
  // distribution-bar assertions never flake on shared-DB seed drift. The feed
  // deliberately spans TWO calendar days so date-group headers are exercised.
  const MOCK_ACTIVITY = {
    recentActivity: [
      {
        eventId: 'evt-today-status',
        eventType: 'STATUS_CHANGE',
        exhibitId: 'ex-1',
        exhibitLabel: 'P-1',
        summary: 'Status changed from MARKED to OFFERED',
        recordedAt: new Date().toISOString(),
      },
      {
        eventId: 'evt-today-custody',
        eventType: 'CUSTODY_TRANSFER',
        exhibitId: 'ex-2',
        exhibitLabel: 'P-2',
        summary: 'Custody transferred to Deputy Reyes',
        recordedAt: new Date().toISOString(),
      },
      {
        eventId: 'evt-yesterday-objection',
        eventType: 'OBJECTION_RAISED',
        exhibitId: 'ex-3',
        exhibitLabel: 'P-3',
        summary: 'Objection raised on hearsay grounds',
        recordedAt: new Date(Date.now() - 86_400_000).toISOString(),
      },
    ],
    statusCounts: {
      MARKED: 1,
      OFFERED: 2,
      OBJECTED: 1,
      ADMITTED: 5,
      EXCLUDED: 1,
      WITHDRAWN: 1,
    },
  };

  async function mockActivity(page: Page): Promise<void> {
    await page.route('**/api/cases/**/activity', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_ACTIVITY),
      });
    });
  }

  test('renders the 4 stat cards, with the jury-blockers card red-outlined only when > 0', async ({
    page,
  }) => {
    await mockActivity(page);
    await page.goto('/command-center');

    const row = page.getByTestId('stat-card-row');
    await expect(row).toBeVisible();
    // Admitted card sources from statusCounts: 5 of (1+2+1+5+1+1)=11.
    await expect(row).toContainText('5 of 11');
    await expect(row).toContainText('Admitted');
    await expect(row).toContainText('Open objections');
    await expect(row).toContainText('Custody gaps');
    await expect(row).toContainText('Jury package blockers');
    // Admitted sub-caption surfaces excluded/withdrawn.
    await expect(row).toContainText('1 excluded');
    await expect(row).toContainText('1 withdrawn');

    // The jury-blockers card carries the shared critical treatment ONLY when its
    // count is > 0 (data-critical flips on the shared Card). We don't assert the
    // exact seeded blocker count (shared-DB), only the invariant: critical iff >0.
    const juryCard = page.getByTestId('stat-card-jury-blockers');
    const critical = await juryCard.getAttribute('data-critical');
    const text = await juryCard.innerText();
    const count = Number((text.match(/\d+/) ?? ['0'])[0]);
    expect(critical).toBe(count > 0 ? 'true' : 'false');
  });

  test('the status-distribution legend shows all 6 status labels with counts', async ({
    page,
  }) => {
    await mockActivity(page);
    await page.goto('/command-center');

    const legend = page.getByTestId('status-distribution-legend');
    await expect(legend).toBeVisible();
    for (const label of ['Marked', 'Offered', 'Objected', 'Admitted', 'Excluded', 'Withdrawn']) {
      await expect(legend).toContainText(label);
    }
    await expect(page.getByTestId('status-distribution-bar')).toBeVisible();
  });

  test('the page-local screen header shows the title and a live-status dot', async ({ page }) => {
    await page.goto('/command-center');
    await expect(page.getByRole('heading', { name: 'Trial Command Center' })).toBeVisible();
    await expect(page.getByTestId('live-status-dot')).toBeVisible();
    await expect(page.getByTestId('command-center-subtitle')).toBeVisible();
  });

  test('Custody at a Glance shows at least one named group and the no-custodian row', async ({
    page,
  }) => {
    // Real seed: P-2/P-6 are custody-less (no-custodian row); other exhibits
    // have a custodian (≥1 named group). As JUDGE the inline action is absent
    // (JUDGE is not a custody role) — assert the structure regardless of role.
    await page.goto('/command-center');
    const panel = page.getByTestId('custody-at-a-glance');
    await expect(panel).toBeVisible();
    // At least one custodian group renders.
    await expect(panel.getByTestId('custody-group').first()).toBeVisible();
    // The distinct no-custodian row renders (P-2 is custody-less on a fresh seed;
    // P-6 legacy-admit is also custody-less).
    await expect(panel.getByTestId('custody-group-no-custodian')).toBeVisible();
  });

  test('the custody transfer action is absent for JUDGE but present for DEPUTY and expands inline', async ({
    page,
  }) => {
    // The inline action is gated on the CLIENT role in the roleStore (absent-not-
    // disabled), so it is driven by the real role-switcher dropdown — not a
    // request-header override. Switching the active user to a DEPUTY both flips
    // the store role AND makes the custody hook re-query as DEPUTY via apiFetch.
    await page.goto('/command-center');
    const panel = page.getByTestId('custody-at-a-glance');
    await expect(panel).toBeVisible();
    await expect(panel.getByTestId('custody-group').first()).toBeVisible();

    // Default JUDGE: no transfer/assign triggers anywhere in the panel.
    await expect(panel.getByTestId('custody-glance-transfer-action')).toHaveCount(0);

    // Switch to a DEPUTY persona via the shared role-switcher.
    const select = page.getByLabel('Switch active role');
    await expect(select.locator('option')).toHaveCount(6);
    const deputyOption = select.locator('option', { hasText: '(DEPUTY)' });
    const deputyValue = await deputyOption.getAttribute('value');
    await select.selectOption(deputyValue!);

    // The trigger is now present; clicking it expands the shared
    // TransferCustodyForm inline.
    const trigger = panel.getByTestId('custody-glance-transfer-action').first();
    await expect(trigger).toBeVisible();
    await trigger.click();
    await expect(panel.getByTestId('transfer-custody-form')).toBeVisible();
  });

  test('activity filter pills narrow the rendered list client-side; All restores it', async ({
    page,
  }) => {
    await mockActivity(page);
    await page.goto('/command-center');

    const list = page.getByTestId('recent-activity-list');
    await expect(list).toBeVisible();
    // All active by default: all three mock rows render.
    await expect(page.getByTestId('activity-filter-pills')).toBeVisible();
    await expect(page.getByTestId('recent-activity-row')).toHaveCount(3);

    // Click "Custody": only the CUSTODY_TRANSFER row remains.
    await page.getByTestId('activity-filter-pill-custody').click();
    await expect(page.getByTestId('recent-activity-row')).toHaveCount(1);
    await expect(list).toContainText('Custody transferred');
    await expect(list).not.toContainText('Status changed');

    // "All" restores the full list — with NO new network request (client-side).
    let activityCalls = 0;
    page.on('request', (req) => {
      if (req.url().includes('/activity')) activityCalls += 1;
    });
    await page.getByTestId('activity-filter-pill-all').click();
    await expect(page.getByTestId('recent-activity-row')).toHaveCount(3);
    // No activity re-fetch was triggered by the pill click itself.
    expect(activityCalls).toBe(0);
  });

  test('date-group headers render with the exact TODAY/YESTERDAY · date format', async ({
    page,
  }) => {
    await mockActivity(page);
    await page.goto('/command-center');

    const headers = page.getByTestId('activity-date-group-header');
    // The mock spans two days → two headers.
    await expect(headers).toHaveCount(2);
    await expect(headers.first()).toContainText(/^TODAY · [A-Z]{3} \d{1,2}, \d{4}$/);
    await expect(headers.nth(1)).toContainText(/^YESTERDAY · [A-Z]{3} \d{1,2}, \d{4}$/);
  });

  test('each activity row renders its exhibit label via the shared ExhibitTag chip', async ({
    page,
  }) => {
    await mockActivity(page);
    await page.goto('/command-center');
    const firstRow = page.getByTestId('recent-activity-row').first();
    await expect(firstRow).toBeVisible();
    // The label is now an ExhibitTag chip, not a plain-text prefix.
    await expect(firstRow.getByTestId('exhibit-tag').first()).toBeVisible();
    await expect(firstRow.getByTestId('exhibit-tag').first()).toHaveText('P-1');
  });
});
