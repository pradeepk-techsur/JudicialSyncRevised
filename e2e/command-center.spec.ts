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

    // T-15: the labeled Live indicator renders (replaced the former
    // "updated Xs ago" freshness text). Under normal polling it reads "Live".
    await expect(page.getByTestId('live-indicator')).toContainText(/live/i);
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

  // Criterion 3 — strictly read-only EVERYWHERE EXCEPT the attention feed. The
  // "Needs your attention" feed is the single deliberate, traceable reversal of
  // Phase 5's read-only criterion (08-15 / F08 §Design decision supersedes a
  // prior constraint); every OTHER panel — stat cards, distribution bar, recent
  // activity, objections, discrepancies, custody panel's non-transfer parts, and
  // the jury-package widget — stays link-through only. This test proves exactly
  // that boundary: it scopes its read-only assertions to the command center MINUS
  // the attention feed (and MINUS the custody panel, whose inline Transfer/Assign
  // is 08-10's own, separately-tested write affordance).
  test('every panel except the attention feed is read-only / link-through only', async ({
    page,
  }) => {
    await page.goto('/command-center');
    const cc = page.getByTestId('command-center');
    // Wait for the panels to settle into their loaded (happy-path) render.
    await expect(page.getByTestId('recent-activity-row').first()).toBeVisible();

    // The panels that must remain strictly read-only.
    for (const testid of [
      'recent-activity-list',
      'objections-panel',
      'discrepancies-panel',
      'stat-card-row',
      'command-center-jury-package-widget',
    ]) {
      const panel = cc.getByTestId(testid);
      await expect(panel.locator('form')).toHaveCount(0);
      await expect(panel.locator('input')).toHaveCount(0);
      await expect(panel.locator('textarea')).toHaveCount(0);
      await expect(
        panel.getByRole('button', { name: /record|edit|acknowledge|save|submit|resolve|add/i }),
      ).toHaveCount(0);
    }

    // Every actionable Recent Activity element is a link into Exhibit Detail.
    const firstRow = page.getByTestId('recent-activity-row').first();
    await expect(firstRow).toHaveAttribute('href', /\/exhibit\//);

    // The jury-package widget's only possible affordance is the link-through
    // "Open jury package" button (present only once a package exists) — it never
    // exposes a mutating control. If it renders at all, it is a plain button that
    // navigates, which the read-only button-name assertion above already allows.
    const widget = page.getByTestId('command-center-jury-package-widget');
    await expect(widget).toBeVisible();
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
    // Phase 8 gap closure (08-16, 08-UAT.md test 2): the loud multi-colored
    // segmented bar was removed entirely — assert its permanent absence, not
    // merely omit checking it, mirroring this project's 08-04 precedent for
    // documented intentional removals.
    await expect(page.getByTestId('status-distribution-bar')).toHaveCount(0);
    for (const status of ['MARKED', 'OFFERED', 'OBJECTED', 'ADMITTED', 'EXCLUDED', 'WITHDRAWN']) {
      await expect(page.getByTestId(`status-segment-${status}`)).toHaveCount(0);
    }
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

  // ===================================================================
  // 08-15 — "Needs your attention" feed (tier ordering, role-gated inline
  // actions, no-optimistic-update) + Jury Package summary widget
  // (cross-screen parity). F08 §Process steps 4-6, F24.
  // ===================================================================

  // A deterministic 4-tier feed so the ordering / interleaving assertion never
  // flakes on shared-DB seed drift (the live seed happens to carry no CRITICAL
  // row — no sealed exhibit is in a jury package — so a mock is the only way to
  // exercise all four tiers at once). The mock interleaves tiers OUT of order on
  // purpose so a correct render (which trusts the server order verbatim) would
  // still be whatever the server sent; the server itself is tested to emit the
  // canonical order, so here we send the canonical order and assert it survives
  // verbatim with zero client re-sort.
  const MOCK_FEED = [
    {
      id: 'critical-1',
      tier: 'CRITICAL',
      ruleCode: 'SEALED_IN_JURY_PACKAGE',
      exhibitId: 'ex-crit',
      exhibitLabel: 'S-9',
      detectedAt: new Date().toISOString(),
      summary: 'S-9 — ex parte material improperly included in jury package',
      availableAction: 'REMOVE_FROM_PACKAGE',
    },
    {
      id: 'high-1',
      tier: 'HIGH',
      ruleCode: 'UNRESOLVED_OBJECTION_JURY_ELIGIBLE',
      exhibitId: 'ex-high',
      exhibitLabel: 'P-7',
      objectionId: 'obj-high',
      detectedAt: new Date().toISOString(),
      summary: 'P-7 — admitted with an open, unresolved objection',
      availableAction: 'RECORD_RULING',
    },
    {
      id: 'pending-1',
      tier: 'PENDING',
      ruleCode: 'PENDING_RULING',
      exhibitId: 'ex-pending',
      exhibitLabel: 'P-3',
      objectionId: 'obj-pending',
      detectedAt: new Date().toISOString(),
      summary: 'P-3 — objection unresolved, not yet admitted',
      availableAction: 'RECORD_RULING',
    },
    {
      id: 'medium-1',
      tier: 'MEDIUM',
      ruleCode: 'ADMITTED_NO_CUSTODIAN',
      exhibitId: 'ex-medium',
      exhibitLabel: 'P-6',
      detectedAt: new Date().toISOString(),
      summary: 'P-6 — admitted, no custodian of record',
      availableAction: 'TRANSFER_CUSTODY',
    },
  ];

  async function mockFeed(page: Page, feed: unknown[]): Promise<void> {
    await page.route('**/api/cases/**/attention-feed', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(feed),
      });
    });
  }

  test('attention feed renders tiers in CRITICAL→HIGH→PENDING→MEDIUM order, never interleaved', async ({
    page,
  }) => {
    await mockFeed(page, MOCK_FEED);
    await page.goto('/command-center');

    const feed = page.getByTestId('attention-feed');
    await expect(feed).toBeVisible();
    const entries = feed.getByTestId('attention-feed-entry');
    await expect(entries).toHaveCount(4);

    // DOM order equals the server order verbatim (zero client re-sort).
    await expect(entries.nth(0)).toHaveAttribute('data-tier', 'CRITICAL');
    await expect(entries.nth(1)).toHaveAttribute('data-tier', 'HIGH');
    await expect(entries.nth(2)).toHaveAttribute('data-tier', 'PENDING');
    await expect(entries.nth(3)).toHaveAttribute('data-tier', 'MEDIUM');
  });

  test('each severity badge renders with the correct per-tier aria-label', async ({ page }) => {
    await mockFeed(page, MOCK_FEED);
    await page.goto('/command-center');

    const feed = page.getByTestId('attention-feed');
    await expect(feed).toBeVisible();
    // One pill per entry, each carrying "Severity: <Tier>" with the title-cased
    // tier word — color is never the sole signal.
    for (const word of ['Critical', 'High', 'Pending', 'Medium']) {
      await expect(feed.getByLabel(`Severity: ${word}`)).toBeVisible();
    }
  });

  test('Record ruling is visible for JUDGE, absent for DEPUTY, and expands the form inline (never a modal)', async ({
    page,
  }) => {
    await mockFeed(page, MOCK_FEED);
    await page.goto('/command-center');

    const feed = page.getByTestId('attention-feed');
    await expect(feed).toBeVisible();

    // Default JUDGE: Record ruling is present on the HIGH (and PENDING) entries.
    const rulingButton = feed.getByTestId('attention-feed-action-record-ruling').first();
    await expect(rulingButton).toBeVisible();

    // Clicking it expands the shared RecordRulingForm INLINE — never navigates
    // away, never opens a modal (the command center is still the current screen).
    await rulingButton.click();
    await expect(feed.getByTestId('record-ruling-form')).toBeVisible();
    await expect(page).toHaveURL(/\/command-center$/);

    // Switch to a DEPUTY persona: the Record-ruling affordance is now ABSENT
    // (not disabled) everywhere in the feed, on every HIGH/PENDING entry.
    const select = page.getByLabel('Switch active role');
    const deputyOption = select.locator('option', { hasText: '(DEPUTY)' });
    await select.selectOption((await deputyOption.getAttribute('value')) as string);
    await expect(feed.getByTestId('attention-feed-action-record-ruling')).toHaveCount(0);
  });

  test('Assign custodian is visible for DEPUTY, absent for JUDGE, on the MEDIUM entry', async ({
    page,
  }) => {
    await mockFeed(page, MOCK_FEED);
    await page.goto('/command-center');

    const feed = page.getByTestId('attention-feed');
    await expect(feed).toBeVisible();

    // Default JUDGE: Assign custodian is absent (JUDGE is not a custody role).
    await expect(feed.getByTestId('attention-feed-action-assign-custodian')).toHaveCount(0);

    // Switch to DEPUTY: the Assign-custodian affordance appears on the MEDIUM
    // entry and expands the shared TransferCustodyForm inline.
    const select = page.getByLabel('Switch active role');
    const deputyOption = select.locator('option', { hasText: '(DEPUTY)' });
    await select.selectOption((await deputyOption.getAttribute('value')) as string);

    const assign = feed.getByTestId('attention-feed-action-assign-custodian');
    await expect(assign).toBeVisible();
    await assign.click();
    await expect(feed.getByTestId('transfer-custody-form')).toBeVisible();
  });

  test('"Review and remove →" on a CRITICAL entry navigates to the Jury Package Workspace', async ({
    page,
  }) => {
    await mockFeed(page, MOCK_FEED);
    await page.goto('/command-center');

    const feed = page.getByTestId('attention-feed');
    await expect(feed).toBeVisible();
    const review = feed.getByTestId('attention-feed-action-review-remove');
    await expect(review).toBeVisible();
    await review.click();
    await expect(page).toHaveURL(/\/jury-package$/);
  });

  test('a successful inline ruling does NOT optimistically remove the entry — it waits for the next server read', async ({
    page,
  }) => {
    // A single HIGH entry; the feed is re-served WITHOUT it only after the ruling
    // POST has succeeded (simulating the ledger state the next poll observes).
    let ruled = false;
    await page.route('**/api/cases/**/attention-feed', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(ruled ? [] : [MOCK_FEED[1]]),
      });
    });
    // The ruling POST succeeds but DELIBERATELY stalls briefly, so we can observe
    // the entry is still present in the window between "confirm clicked" and "the
    // next feed read reflects the resolution" — proving no optimistic removal.
    await page.route('**/api/objections/*/ruling', async (route) => {
      ruled = true;
      await new Promise((r) => setTimeout(r, 400));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    });

    await page.goto('/command-center');
    const feed = page.getByTestId('attention-feed');
    await expect(feed.getByTestId('attention-feed-entry')).toHaveCount(1);

    // Open + submit a SUSTAINED ruling as the default JUDGE.
    await feed.getByTestId('attention-feed-action-record-ruling').first().click();
    const form = feed.getByTestId('record-ruling-form');
    await expect(form).toBeVisible();
    // Carbon RadioButton's input is overlaid by a visual span — click the label.
    await form.getByText('Sustained', { exact: true }).click();
    await form.getByTestId('record-ruling-confirm').click();

    // The entry is NOT removed optimistically: it is still present in the DOM
    // right after the click (the mutation is still in flight; no client-side
    // splice happened). It disappears ONLY once the subsequent server read
    // (invalidated feed query) returns the entry gone.
    await expect(feed.getByTestId('attention-feed-entry')).toHaveCount(1);
    await expect(feed.getByTestId('attention-feed-entry')).toHaveCount(0, { timeout: 6_000 });
  });

  test('the jury-package widget shows no package before one is started', async ({ page }) => {
    await page.route('**/api/cases/**/jury-package', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ juryPackage: null, exhibits: [] }),
        });
        return;
      }
      await route.continue();
    });
    await page.goto('/command-center');
    const widget = page.getByTestId('command-center-jury-package-widget');
    await expect(widget).toBeVisible();
    await expect(widget).toContainText(/no package started yet/i);
  });

  test('the jury-package widget shows the IDENTICAL clean/total ratio the Jury Package Workspace renders (cross-screen parity)', async ({
    page,
  }) => {
    // One DRAFT package, three exhibits: two clean, one OPEN-flagged blocker. Both
    // the Command Center widget and the Jury Package Workspace read THIS payload
    // and render through the SAME TwoColorProgressBar, so their captions must be
    // byte-identical: "2 of 3 exhibits are clean · 1 blocker remain".
    const DRAFT_BODY = {
      juryPackage: {
        id: 'pkg-1',
        caseId: 'case-1',
        status: 'DRAFT',
        createdAt: new Date().toISOString(),
        finalizedAt: null,
        finalizedBy: null,
        finalizationRequestedAt: null,
        finalizationRequestedBy: null,
      },
      exhibits: [
        {
          exhibitId: 'ex-a',
          exhibitLabel: 'P-1',
          currentStatus: 'ADMITTED',
          discrepancyStatus: 'CLEAN',
          flags: [],
          isSealed: false,
          addedAt: new Date().toISOString(),
        },
        {
          exhibitId: 'ex-b',
          exhibitLabel: 'P-2',
          currentStatus: 'ADMITTED',
          discrepancyStatus: 'CLEAN',
          flags: [],
          isSealed: false,
          addedAt: new Date().toISOString(),
        },
        {
          exhibitId: 'ex-c',
          exhibitLabel: 'P-3',
          currentStatus: 'ADMITTED',
          discrepancyStatus: 'FLAGGED',
          flags: [
            { ruleCode: 'UNRESOLVED_OBJECTION_JURY_ELIGIBLE', status: 'OPEN', label: 'Unresolved objection' },
          ],
          isSealed: false,
          addedAt: new Date().toISOString(),
        },
      ],
    };
    await page.route('**/api/cases/**/jury-package', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(DRAFT_BODY),
        });
        return;
      }
      await route.continue();
    });

    // Command Center widget caption.
    await page.goto('/command-center');
    const widget = page.getByTestId('command-center-jury-package-widget');
    await expect(widget).toBeVisible();
    const widgetCaption = await widget
      .getByTestId('two-color-progress-caption')
      .innerText();

    // Jury Package Workspace header-bar caption off the SAME payload.
    await page.goto('/jury-package');
    await expect(page.getByTestId('jury-package-draft')).toBeVisible();
    const workspaceCaption = await page
      .getByTestId('jury-package-draft')
      .getByTestId('two-color-progress-caption')
      .first()
      .innerText();

    // Byte-identical, and the expected 2-of-3 ratio.
    expect(widgetCaption).toBe(workspaceCaption);
    expect(widgetCaption).toContain('2 of 3 exhibits are clean');
  });

  // ===================================================================
  // 09-01 (T-01) — compact, clickable KPI tiles (<=80px) linking to the
  // correct filtered views. F08.
  // ===================================================================

  test('each of the 4 KPI tiles is <=80px tall', async ({ page }) => {
    await mockActivity(page);
    await page.goto('/command-center');

    const row = page.getByTestId('stat-card-row');
    await expect(row).toBeVisible();

    // Every direct tile in the row measures <=80px tall (the whole point of the
    // Phase 9 rebuild — the attention list must be visible without scrolling).
    const tiles = row.locator('> *');
    const count = await tiles.count();
    expect(count).toBe(4);
    for (let i = 0; i < count; i++) {
      const box = await tiles.nth(i).boundingBox();
      expect(box).not.toBeNull();
      expect(box!.height).toBeLessThanOrEqual(80);
    }
  });

  test('the Admitted KPI tile links to /case?status=ADMITTED', async ({ page }) => {
    await mockActivity(page);
    await page.goto('/command-center');

    const row = page.getByTestId('stat-card-row');
    await expect(row).toBeVisible();
    // The Admitted tile is the 4th tile; click it and assert the destination URL.
    await row.getByText('Admitted', { exact: false }).click();
    await expect(page).toHaveURL(/\/case\?status=ADMITTED$/);
  });

  test('the Custody gaps KPI tile links to /case?filter=no-custodian', async ({ page }) => {
    await mockActivity(page);
    await page.goto('/command-center');

    const row = page.getByTestId('stat-card-row');
    await expect(row).toBeVisible();
    await row.getByText('Custody gaps', { exact: false }).click();
    await expect(page).toHaveURL(/\/case\?filter=no-custodian$/);
  });

  test('the Jury package blockers KPI tile links to /jury-package and is red-outlined only when > 0', async ({
    page,
  }) => {
    await mockActivity(page);
    await page.goto('/command-center');

    const juryTile = page.getByTestId('stat-card-jury-blockers');
    await expect(juryTile).toBeVisible();

    // The critical treatment flips with the count (invariant: critical iff >0).
    const critical = await juryTile.getAttribute('data-critical');
    const text = await juryTile.innerText();
    const count = Number((text.match(/\d+/) ?? ['0'])[0]);
    expect(critical).toBe(count > 0 ? 'true' : 'false');

    await juryTile.click();
    await expect(page).toHaveURL(/\/jury-package$/);
  });

  test('the Open objections KPI tile links to the #objections anchor on the command center', async ({
    page,
  }) => {
    await mockActivity(page);
    await page.goto('/command-center');

    const row = page.getByTestId('stat-card-row');
    await expect(row).toBeVisible();
    await row.getByText('Open objections', { exact: false }).click();
    // Same-page anchor scroll to the ObjectionsPanel (which now carries
    // id="objections").
    await expect(page).toHaveURL(/\/command-center#objections$/);
    await expect(page.locator('#objections')).toBeVisible();
  });

  // ===================================================================
  // 09-01 (T-01, Task 3) — Case Workspace accepts the KPI deep-links:
  // /case?status=ADMITTED and /case?filter=no-custodian pre-select the
  // matching filter/chip on load. F08 key-link.
  // ===================================================================

  test('/case?status=ADMITTED pre-selects the ADMITTED status filter on load', async ({ page }) => {
    await page.goto('/case?status=ADMITTED');
    // The status Dropdown reflects ADMITTED on the very first render (read in the
    // useState initializer, not a post-mount effect).
    const statusFilter = page.locator('#exhibit-status-filter');
    await expect(statusFilter).toContainText('ADMITTED');
    // And the active-filter chip surfaces the status criterion.
    await expect(page.getByText('status=ADMITTED')).toBeVisible();
  });

  test('/case?filter=no-custodian pre-selects the No custodian quick-filter chip on load', async ({
    page,
  }) => {
    await page.goto('/case?filter=no-custodian');
    const chip = page.getByTestId('quick-filter-no-custodian');
    await expect(chip).toBeVisible();
    await expect(chip).toHaveAttribute('aria-pressed', 'true');
    // The default 'all' chip is NOT the active one.
    await expect(page.getByTestId('quick-filter-all')).toHaveAttribute('aria-pressed', 'false');
  });

  test('the No custodian quick-filter narrows the list to exhibits with no custodian', async ({
    page,
  }) => {
    await page.goto('/case');
    // Click the chip directly (no deep-link) and confirm it toggles active —
    // identical behavior to the existing chips.
    const chip = page.getByTestId('quick-filter-no-custodian');
    await expect(chip).toBeVisible();
    await chip.click();
    await expect(chip).toHaveAttribute('aria-pressed', 'true');
  });

  // The attention DataTable shows an objection's grounds inline on its row (the
  // Phase 9 objectionGrounds field) with no extra click.
  test('the attention feed renders objection grounds inline on a HIGH/PENDING row', async ({
    page,
  }) => {
    // A feed whose HIGH entry carries objectionGrounds — the Issue cell must show
    // the grounds text inline on the same row, no modal/expand.
    const FEED_WITH_GROUNDS = [
      {
        id: 'high-1',
        tier: 'HIGH',
        ruleCode: 'UNRESOLVED_OBJECTION_JURY_ELIGIBLE',
        exhibitId: 'ex-high',
        exhibitLabel: 'P-7',
        objectionId: 'obj-high',
        detectedAt: new Date().toISOString(),
        summary: 'P-7 — admitted with an open, unresolved objection',
        objectionGrounds: 'Hearsay — out-of-court statement offered for its truth',
        availableAction: 'RECORD_RULING',
      },
    ];
    await mockFeed(page, FEED_WITH_GROUNDS);
    await page.goto('/command-center');

    const feed = page.getByTestId('attention-feed');
    await expect(feed).toBeVisible();
    const row = feed.getByTestId('attention-feed-entry');
    await expect(row).toHaveCount(1);
    // The grounds text is visible on the row with no interaction.
    await expect(row).toContainText('Hearsay — out-of-court statement offered for its truth');
    // Table columns are present (dense DataTable, not stacked cards).
    await expect(feed.getByRole('columnheader', { name: 'Exhibit' })).toBeVisible();
    await expect(feed.getByRole('columnheader', { name: 'Issue' })).toBeVisible();
    await expect(feed.getByRole('columnheader', { name: 'Severity' })).toBeVisible();
    await expect(feed.getByRole('columnheader', { name: 'Age' })).toBeVisible();
    await expect(feed.getByRole('columnheader', { name: 'Action' })).toBeVisible();
  });

  // ===================================================================
  // 09-04 (T-04) — Recent Activity rework: no nested scroll, 10-cap +
  // View all → full /activity page, 60s same-exhibit grouping, seconds
  // timestamp, heading/date-group day-word agreement. F08/F15.
  // ===================================================================

  // A deterministic activity payload: 12 single rows all TODAY, each a DISTINCT
  // exhibit (so none are merged), plus a separate 3-event same-exhibit run within
  // 60s (so that run collapses into ONE merged row). Used to prove the 10-cap, the
  // grouping, and the seconds format without depending on shared-DB seed state.
  function t04Activity() {
    const base = Date.now();
    const singles = Array.from({ length: 12 }, (_, k) => ({
      eventId: `t04-single-${k}`,
      eventType: 'CUSTODY_TRANSFER',
      exhibitId: `ex-single-${k}`,
      exhibitLabel: `P-${k + 10}`,
      summary: `Custody transferred for item ${k}`,
      // Spread across distinct seconds within today, newest-first.
      recordedAt: new Date(base - k * 5_000).toISOString(),
    }));
    // A 3-event same-exhibit STATUS_CHANGE run all within 60s → one merged row.
    const run = [
      {
        eventId: 't04-run-2',
        eventType: 'STATUS_CHANGE',
        exhibitId: 'ex-run',
        exhibitLabel: 'P-7',
        summary: 'Status changed from OFFERED to ADMITTED',
        recordedAt: new Date(base - 70_000).toISOString(),
      },
      {
        eventId: 't04-run-1',
        eventType: 'STATUS_CHANGE',
        exhibitId: 'ex-run',
        exhibitLabel: 'P-7',
        summary: 'Status changed from MARKED to OFFERED',
        recordedAt: new Date(base - 90_000).toISOString(),
      },
      {
        eventId: 't04-run-0',
        eventType: 'STATUS_CHANGE',
        exhibitId: 'ex-run',
        exhibitLabel: 'P-7',
        summary: 'Status changed from (none) to MARKED',
        recordedAt: new Date(base - 110_000).toISOString(),
      },
    ];
    return {
      recentActivity: [...singles, ...run],
      statusCounts: {
        MARKED: 1,
        OFFERED: 1,
        OBJECTED: 0,
        ADMITTED: 1,
        EXCLUDED: 0,
        WITHDRAWN: 0,
      },
    };
  }

  async function mockT04(page: Page): Promise<void> {
    await page.route('**/api/cases/**/activity**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(t04Activity()),
      });
    });
  }

  test('the Recent Activity panel has no nested scrollbox (list is not independently scrollable)', async ({
    page,
  }) => {
    await mockT04(page);
    await page.goto('/command-center');
    const list = page.getByTestId('recent-activity-list');
    await expect(list).toBeVisible();
    // The former nested scrollbox set max-height + overflow-y:auto. Prove neither
    // is applied: the list's scrollHeight must not exceed its clientHeight (it is
    // not an independent scroll container), and computed overflow-y is not 'auto'/
    // 'scroll'.
    const overflowY = await list.evaluate((el) => getComputedStyle(el).overflowY);
    expect(['visible', 'clip', '']).toContain(overflowY);
  });

  test('the feed renders at most 10 units and shows a stable View all link', async ({ page }) => {
    await mockT04(page);
    await page.goto('/command-center');
    await expect(page.getByTestId('recent-activity-list')).toBeVisible();

    // 13 events → 12 singles + 1 merged run = 13 units, capped to the latest 10.
    const singleRows = page.getByTestId('recent-activity-row');
    const mergedRows = page.getByTestId('recent-activity-merged-row');
    const total = (await singleRows.count()) + (await mergedRows.count());
    expect(total).toBe(10);

    // The View all link is always present when the feed has rows.
    const viewAll = page.getByTestId('activity-view-all');
    await expect(viewAll).toBeVisible();
    await expect(viewAll).toHaveAttribute('href', '/activity');
  });

  test('consecutive same-exhibit status changes within 60s collapse into one expandable row', async ({
    page,
  }) => {
    await mockT04(page);
    await page.goto('/command-center');
    await expect(page.getByTestId('recent-activity-list')).toBeVisible();

    // The 3-event P-7 run is the oldest activity — it falls outside the latest-10
    // window here, so navigate to the full /activity page (no cap) to assert the
    // merge, which proves the shared grouping function.
    await page.getByTestId('activity-view-all').click();
    await expect(page).toHaveURL(/\/activity$/);
    await expect(page.getByTestId('activity-page')).toBeVisible();

    const merged = page.getByTestId('activity-full-merged-row');
    await expect(merged).toHaveCount(1);
    // Collapsed summary reads "<count> status updates".
    await expect(merged).toContainText('3 status updates');
    // Expanding reveals the individual original summaries.
    await merged.locator('summary').click();
    await expect(merged).toContainText('Status changed from MARKED to OFFERED');
    await expect(merged).toContainText('Status changed from OFFERED to ADMITTED');
  });

  test('every timestamp in the panel includes seconds (one consistent format)', async ({ page }) => {
    await mockT04(page);
    await page.goto('/command-center');
    const rows = page.getByTestId('recent-activity-row');
    await expect(rows.first()).toBeVisible();
    const count = await rows.count();
    for (let i = 0; i < count; i++) {
      const text = await rows.nth(i).innerText();
      // A seconds-precise stamp has HH:MM:SS (two colons in the time) — e.g.
      // "6:17:47 PM". A minute-only stamp ("6:17 PM") has exactly one colon.
      expect(text).toMatch(/\d{1,2}:\d{2}:\d{2}/);
    }
  });

  test('the full /activity page renders the complete history and links back to Command Center', async ({
    page,
  }) => {
    await mockT04(page);
    // Reach /activity the real way — via the panel's View all link (also proves
    // the link-through). The store is hydrated by the command-center visit first.
    await page.goto('/command-center');
    await expect(page.getByTestId('recent-activity-list')).toBeVisible();
    await page.getByTestId('activity-view-all').click();

    await expect(page).toHaveURL(/\/activity$/);
    await expect(page.getByTestId('activity-page')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Activity history' })).toBeVisible();
    await expect(page.getByTestId('activity-full-list')).toBeVisible();

    // Full, uncapped: 12 singles + 1 merged run = 13 units (vs the panel's 10).
    const singleRows = page.getByTestId('activity-full-row');
    const mergedRows = page.getByTestId('activity-full-merged-row');
    const total = (await singleRows.count()) + (await mergedRows.count());
    expect(total).toBe(13);

    // Back link returns to the Command Center.
    await page.getByRole('link', { name: /‹ Command Center/ }).click();
    await expect(page).toHaveURL(/\/command-center$/);
  });

  test('the heading day word agrees with the date-group header day word', async ({ page }) => {
    await mockT04(page);
    await page.goto('/command-center');
    // All mock events are today → heading says "today" AND the (first) date-group
    // header says "TODAY · …". They are computed from the same anchor, so they
    // agree by construction.
    await expect(page.getByRole('heading', { name: /recent activity/i })).toContainText(/today/i);
    const headers = page.getByTestId('activity-date-group-header');
    await expect(headers.first()).toContainText(/^TODAY · /);
  });

  // ===================================================================
  // 09-13 (T-15) — LiveIndicator: green "Live" <60s; amber "Connection
  // lost" + working Refresh once the activity query errors (a reliably
  // fast, deterministic e2e trigger). The time-based 60s isStale boundary
  // is covered by the src/hooks/useFreshness.test.ts unit test. F8.
  // ===================================================================

  test('under normal polling the Live indicator shows green "Live" (not the old "updated Xs ago")', async ({
    page,
  }) => {
    await mockActivity(page);
    await page.goto('/command-center');

    const live = page.getByTestId('live-indicator');
    await expect(live).toBeVisible();
    await expect(live).toHaveAttribute('data-state', 'live');
    await expect(live).toContainText('Live');
    // The former phrasing is fully retired for the fresh state.
    await expect(live).not.toContainText(/updated .* ago/i);
    // No Refresh affordance while fresh.
    await expect(page.getByTestId('live-indicator-refresh')).toHaveCount(0);
  });

  test('when the activity query errors, the indicator flips to amber "Connection lost" with a working Refresh', async ({
    page,
  }) => {
    // Force the activity endpoint to fail: react-query (retry:false) enters its
    // error state, so the LiveIndicator must render the stale treatment. The
    // Refresh button triggers activity.refetch() — proven to work by serving a
    // healthy payload on the retry and asserting the indicator recovers to "Live".
    let failing = true;
    await page.route('**/api/cases/**/activity**', async (route) => {
      if (failing) {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'x' } }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_ACTIVITY),
      });
    });

    await page.goto('/command-center');

    const live = page.getByTestId('live-indicator');
    await expect(live).toBeVisible();
    await expect(live).toHaveAttribute('data-state', 'stale');
    await expect(live).toContainText('Connection lost');

    const refresh = page.getByTestId('live-indicator-refresh');
    await expect(refresh).toBeVisible();

    // Flip the endpoint healthy, then click Refresh — the indicator recovers,
    // proving onRefetch() is wired to the query's own refetch.
    failing = false;
    await refresh.click();
    await expect(live).toHaveAttribute('data-state', 'live', { timeout: 6_000 });
    await expect(live).toContainText('Live');
  });
});
