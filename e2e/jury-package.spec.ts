import { test, expect, type Page } from '@playwright/test';

// F11 — Jury Package Workspace E2E: the full empty → initiate → hard-disabled
// gate → inline acknowledge → gate re-enables → finalize → export flow, plus the
// view-only role gating.
//
// Determinism / shared-DB notes:
//  - The seeded demo case (2026-CR-0142) boots with admitted exhibits carrying
//    OPEN discrepancies (P-2 custody gap, P-3 unresolved objection), so the gate
//    is demonstrable without manual setup.
//  - The app session is in-memory zustand that resets to JUDGE on every full
//    navigation. To ACT as a DEPUTY (initiate/finalize/acknowledge send the
//    active user's id, whose ACTUAL role the server authorizes against) we switch
//    role via the Header <select> AFTER landing — it updates both role and
//    activeUserId in the SPA session without a navigation that would reset it.
//  - The empty-state assertion is driven via a page.route mock returning
//    { juryPackage: null, exhibits: [] } so it is independent of whether a prior
//    run already initiated/finalized the shared package (the plan explicitly
//    permits this; that a read-only GET returns null is covered by 03-02's
//    integration test).
//  - The live flow MUTATES real shared state (acknowledge is permanent, finalize
//    is terminal). It is written to converge: initiate is idempotent (reuses the
//    living DRAFT), it acknowledges whatever OPEN flags remain, and it tolerates a
//    package that a prior run already finalized.

async function switchRole(page: Page, role: string): Promise<void> {
  const roleSelect = page.getByLabel('Switch active role');
  await expect(roleSelect).toBeEnabled();
  const option = roleSelect.locator('option', { hasText: role });
  await roleSelect.selectOption((await option.getAttribute('value')) as string);
}

async function switchToDeputy(page: Page): Promise<void> {
  await switchRole(page, 'DEPUTY');
}

test.describe('Jury Package Workspace', () => {
  test('empty state: "no package started yet" renders and viewing creates no draft', async ({
    page,
  }) => {
    // Force the read-only GET to report no package, independent of shared state.
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

    await page.goto('/jury-package');
    await expect(page.getByTestId('jury-package-empty')).toBeVisible();
    await expect(page.getByText('No jury package started yet')).toBeVisible();

    // Reload — still empty (viewing never created a side-effect draft).
    await page.reload();
    await expect(page.getByTestId('jury-package-empty')).toBeVisible();
  });

  test('view-only role (ATTORNEY) sees no finalize/acknowledge controls', async ({ page }) => {
    // Return a DRAFT with an OPEN-flagged row so the Draft view renders, then
    // assert the ATTORNEY role (default-adjacent view-only) gets no action
    // controls. We inject the role on the jury-package GET and force a draft body.
    await page.route('**/api/cases/**/jury-package', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            juryPackage: {
              id: 'pkg-1',
              caseId: 'case-1',
              status: 'DRAFT',
              createdAt: new Date().toISOString(),
              finalizedAt: null,
              finalizedBy: null,
            },
            exhibits: [
              {
                exhibitId: 'ex-1',
                exhibitLabel: 'P-3',
                currentStatus: 'ADMITTED',
                discrepancyStatus: 'FLAGGED',
                flags: [
                  {
                    ruleCode: 'UNRESOLVED_OBJECTION_JURY_ELIGIBLE',
                    status: 'OPEN',
                    label: 'Unresolved objection',
                  },
                ],
                addedAt: new Date().toISOString(),
              },
            ],
          }),
        });
        return;
      }
      await route.continue();
    });

    await page.goto('/jury-package');
    await switchToDeputy(page); // first land, then switch to ATTORNEY below
    const roleSelect = page.getByLabel('Switch active role');
    const attorneyOption = roleSelect.locator('option', { hasText: 'ATTORNEY' });
    await roleSelect.selectOption((await attorneyOption.getAttribute('value')) as string);

    await expect(page.getByTestId('jury-package-draft')).toBeVisible();
    await expect(page.getByTestId('jury-finalize')).toHaveCount(0);
    await expect(page.getByTestId('jury-acknowledge-trigger')).toHaveCount(0);
    await expect(page.getByTestId('jury-finalize-restricted')).toBeVisible();
  });

  test('F14: Jury Package Workspace shows the permanence disclosure + relabeled field before, and the full record after', async ({
    page,
    request,
  }) => {
    // UI-only transparency test (mirrors the exhibit-detail F14 test). Mock a
    // DRAFT with one OPEN-flagged row and the case-wide discrepancy list, flipping
    // both to ACKNOWLEDGED once the acknowledge POST fires, so we can assert the
    // disclosure/relabel before and the full record after on THIS screen.
    const caseRes = await request.get('/api/case');
    const { case: kase, users } = await caseRes.json();
    const deputy = users.find((u: { role: string }) => u.role === 'DEPUTY');
    expect(deputy).toBeTruthy();

    const EXHIBIT_ID = 'ex-f14';
    const RULE = 'ADMITTED_NO_CUSTODIAN';
    const FLAG_ID = 'flag-f14-jury';
    const JUSTIFICATION = 'Reviewed and acceptable for jury handoff.';
    let acked = false;

    await page.route('**/api/cases/**/jury-package', async (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          juryPackage: {
            id: 'pkg-f14',
            caseId: kase.id,
            status: 'DRAFT',
            createdAt: new Date().toISOString(),
            finalizedAt: null,
            finalizedBy: null,
          },
          exhibits: [
            {
              exhibitId: EXHIBIT_ID,
              exhibitLabel: 'P-9',
              currentStatus: 'ADMITTED',
              discrepancyStatus: acked ? 'CLEAN' : 'FLAGGED',
              flags: [
                {
                  ruleCode: RULE,
                  status: acked ? 'ACKNOWLEDGED' : 'OPEN',
                  label: 'Admitted without a custodian on record',
                },
              ],
              addedAt: new Date().toISOString(),
            },
          ],
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
            caseId: kase.id,
            exhibitId: EXHIBIT_ID,
            ruleCode: RULE,
            status: acked ? 'ACKNOWLEDGED' : 'OPEN',
            detectedAt: new Date().toISOString(),
            details: {},
            acknowledgedAt: acked ? new Date().toISOString() : null,
            acknowledgedBy: acked ? deputy.id : null,
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

    await page.goto('/jury-package');
    await switchToDeputy(page);
    await expect(page.getByTestId('jury-package-draft')).toBeVisible();

    // Open the inline acknowledge control for the OPEN flag.
    await page.getByTestId('jury-acknowledge-trigger').first().click();

    // BEFORE confirming: disclosure + relabeled field visible.
    await expect(page.getByTestId('acknowledge-disclosure')).toBeVisible();
    await expect(page.getByTestId('acknowledge-disclosure')).toContainText(
      'recorded as a permanent action under your name and role',
    );
    await expect(page.getByLabel(/Justification \(recorded permanently\)/)).toBeVisible();

    // Submit.
    const textarea = page.getByTestId('acknowledge-textarea').first();
    await textarea.fill(JUSTIFICATION);
    await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/acknowledge') && r.request().method() === 'POST',
      ),
      page.getByTestId('acknowledge-confirm').first().click(),
    ]);

    // AFTER: the full record renders inline — acting user's name + justification.
    const record = page.getByTestId('discrepancy-ack-record');
    await expect(record).toBeVisible({ timeout: 10000 });
    await expect(record).toContainText(deputy.name);
    await expect(record).toContainText(JUSTIFICATION);
  });

  test('a legacy sealed exhibit row renders CRITICAL and can be removed from the package (F13)', async ({
    page,
  }) => {
    // F13: a sealed/ex-parte row predating plan 07-03 renders as a CRITICAL
    // blocker with a role-gated Remove-from-Package action. Driven by page.route
    // mocks (the file's established technique): the GET returns a DRAFT with one
    // sealed INCLUDED row until the exclude POST fires, after which the row is
    // gone — the exact server behavior (toView filters EXCLUDED rows).
    let excluded = false;

    await page.route('**/api/cases/**/jury-package', async (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          juryPackage: {
            id: 'pkg-sealed',
            caseId: 'case-1',
            status: 'DRAFT',
            createdAt: new Date().toISOString(),
            finalizedAt: null,
            finalizedBy: null,
          },
          exhibits: excluded
            ? []
            : [
                {
                  exhibitId: 'ex-sealed',
                  exhibitLabel: 'S-2',
                  currentStatus: 'ADMITTED',
                  discrepancyStatus: 'CLEAN',
                  flags: [],
                  isSealed: true,
                  status: 'INCLUDED',
                  addedAt: new Date().toISOString(),
                },
              ],
        }),
      });
    });

    await page.route('**/api/jury-package/*/exhibits/*/exclude', async (route) => {
      excluded = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          event: { eventType: 'JURY_PACKAGE_EXHIBIT_EXCLUDED' },
          juryPackageExhibit: { status: 'EXCLUDED' },
        }),
      });
    });

    await page.goto('/jury-package');
    await switchToDeputy(page);

    // The sealed row now renders as a CRITICAL blocker CARD (red left border via
    // data-critical) inside the Blockers section — the restructure replaced the
    // flat jury-critical-row table cell.
    const criticalCard = page.locator(
      '[data-testid="jury-blocker-card"][data-critical="true"]',
    );
    await expect(criticalCard).toBeVisible();
    await expect(criticalCard).toContainText('Ex parte material');
    await expect(criticalCard).toContainText('must be removed');
    await expect(page.getByTestId('jury-finalize')).toBeDisabled();

    await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/exclude') && r.request().method() === 'POST',
      ),
      page.getByTestId('jury-remove-from-package').click(),
    ]);

    await expect(criticalCard).toHaveCount(0, { timeout: 10000 });
  });

  test('a non-finalizing role (ATTORNEY) sees the CRITICAL row with no Remove action (F13)', async ({
    page,
  }) => {
    await page.route('**/api/cases/**/jury-package', async (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          juryPackage: {
            id: 'pkg-sealed-ro',
            caseId: 'case-1',
            status: 'DRAFT',
            createdAt: new Date().toISOString(),
            finalizedAt: null,
            finalizedBy: null,
          },
          exhibits: [
            {
              exhibitId: 'ex-sealed-ro',
              exhibitLabel: 'S-2',
              currentStatus: 'ADMITTED',
              discrepancyStatus: 'CLEAN',
              flags: [],
              isSealed: true,
              status: 'INCLUDED',
              addedAt: new Date().toISOString(),
            },
          ],
        }),
      });
    });

    await page.goto('/jury-package');
    await switchToDeputy(page); // land first, then switch to ATTORNEY (view-only)
    const roleSelect = page.getByLabel('Switch active role');
    const attorneyOption = roleSelect.locator('option', { hasText: 'ATTORNEY' });
    await roleSelect.selectOption((await attorneyOption.getAttribute('value')) as string);

    const criticalCard = page.locator(
      '[data-testid="jury-blocker-card"][data-critical="true"]',
    );
    await expect(criticalCard).toBeVisible();
    await expect(criticalCard).toContainText('Ex parte material');
    await expect(page.getByTestId('jury-remove-from-package')).toHaveCount(0);
  });

  test('full flow: initiate → hard-disabled gate → acknowledge → gate re-enables → finalize → export', async ({
    page,
    request,
  }) => {
    // [Rule 1 - Bug] This flow used to be driven against the live seed, which
    // booted with admitted exhibits carrying OPEN discrepancies (P-2 custody gap,
    // P-3 unresolved objection). Plan 07-02 made the seed F12-gate-compliant:
    // NO seeded exhibit can any longer be ADMITTED while custody-less or with an
    // open objection, so no seeded exhibit carries an OPEN discrepancy flag and
    // the gate can no longer be demonstrated against live data. Drive the whole
    // flow with page.route mocks instead (the same technique the ATTORNEY
    // role-gating test above already uses) so the UI contract — hard-disabled
    // gate → inline acknowledge → gate re-enables → finalize → export — is tested
    // deterministically and independent of seed state.
    const caseRes = await request.get('/api/case');
    const { case: kase, users } = await caseRes.json();
    const deputy = users.find((u: { role: string }) => u.role === 'DEPUTY');

    const EXHIBIT_ID = 'ex-fullflow';
    const RULE = 'ADMITTED_NO_CUSTODIAN';
    const FLAG_ID = 'flag-fullflow';

    // Mock state progresses: 'draft-open' → 'draft-acked' → 'finalized'.
    let phase: 'draft-open' | 'draft-acked' | 'finalized' = 'draft-open';

    const draftBody = () => ({
      juryPackage: {
        id: 'pkg-fullflow',
        caseId: kase.id,
        status: phase === 'finalized' ? 'FINALIZED' : 'DRAFT',
        createdAt: new Date().toISOString(),
        finalizedAt: phase === 'finalized' ? new Date().toISOString() : null,
        finalizedBy: phase === 'finalized' ? deputy.id : null,
      },
      exhibits: [
        {
          exhibitId: EXHIBIT_ID,
          exhibitLabel: 'P-9',
          currentStatus: 'ADMITTED',
          discrepancyStatus: phase === 'draft-open' ? 'FLAGGED' : 'CLEAN',
          flags: [
            {
              ruleCode: RULE,
              status: phase === 'draft-open' ? 'OPEN' : 'ACKNOWLEDGED',
              label: 'Admitted without a custodian on record',
            },
          ],
          addedAt: new Date().toISOString(),
        },
      ],
    });

    await page.route('**/api/cases/**/jury-package', async (route) => {
      const method = route.request().method();
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(draftBody()),
        });
        return;
      }
      await route.continue();
    });

    await page.route('**/api/cases/**/discrepancies', async (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: FLAG_ID,
            caseId: kase.id,
            exhibitId: EXHIBIT_ID,
            ruleCode: RULE,
            status: phase === 'draft-open' ? 'OPEN' : 'ACKNOWLEDGED',
            detectedAt: new Date().toISOString(),
            details: {},
            acknowledgedAt: phase === 'draft-open' ? null : new Date().toISOString(),
            acknowledgedBy: phase === 'draft-open' ? null : deputy.id,
            resolvedAt: null,
            justification:
              phase === 'draft-open' ? undefined : 'Reviewed and acceptable for jury handoff.',
          },
        ]),
      });
    });

    await page.route('**/api/discrepancies/*/acknowledge', async (route) => {
      phase = 'draft-acked';
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    });

    await page.route('**/api/jury-package/*/finalize', async (route) => {
      phase = 'finalized';
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ juryPackage: draftBody().juryPackage }),
      });
    });

    await page.goto('/jury-package');
    await switchToDeputy(page);

    const draft = page.getByTestId('jury-package-draft');
    const finalized = page.getByTestId('jury-package-finalized');
    await expect(draft).toBeVisible();

    // Draft list shows admitted exhibits with a summary line.
    await expect(page.getByTestId('jury-summary')).toBeVisible();

    const finalizeBtn = page.getByTestId('jury-finalize');

    // The one OPEN-flagged row hard-disables the Finalize button. The restructure
    // renders blocking exhibits as Blockers-section cards (data-blocking="true").
    const blockingRows = page.locator('[data-testid="jury-blocker-card"][data-blocking="true"]');
    await expect(blockingRows).toHaveCount(1);
    await expect(finalizeBtn).toBeDisabled();
    await expect(page.getByTestId('jury-finalize-caption')).toBeVisible();

    // Acknowledge the OPEN flag, exercising the counter + empty-disabled-Confirm.
    await page.getByTestId('jury-acknowledge-trigger').first().click();
    const textarea = page.getByTestId('acknowledge-textarea').first();
    await expect(textarea).toBeVisible();
    const confirm = page.getByTestId('acknowledge-confirm').first();
    await expect(confirm).toBeDisabled(); // disabled while empty
    await textarea.fill('Reviewed and acceptable for jury handoff.');
    await expect(page.getByTestId('acknowledge-counter').first()).toContainText('/500');
    await expect(confirm).toBeEnabled();
    await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/acknowledge') && r.request().method() === 'POST',
      ),
      confirm.click(),
    ]);

    // Gate re-enables once the last OPEN flag is acknowledged (live refetch).
    await expect(finalizeBtn).toBeEnabled({ timeout: 10000 });

    // Finalize → flips in place to the FINALIZED read-only view.
    await finalizeBtn.click();
    await expect(finalized).toBeVisible();
    await expect(page.getByTestId('jury-finalized-banner')).toContainText(
      'FINALIZED ✓ Zero discrepancies',
    );
    await expect(page.getByTestId('jury-export-print')).toBeVisible();
    // Action controls are gone in the finalized view.
    await expect(page.getByTestId('jury-finalize')).toHaveCount(0);
    await expect(page.getByTestId('jury-acknowledge-trigger')).toHaveCount(0);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 08-14: Blockers/Clean restructure + inline remediation + request-finalization
  // ──────────────────────────────────────────────────────────────────────────

  // A DRAFT with one HIGH (unresolved objection) and one MEDIUM (no custodian)
  // blocker plus one clean row, used by several tests below. `resolved` flips the
  // HIGH row to clean so a Record-ruling can move it Blockers → Clean.
  function mixedDraftBody(caseId: string, opts: { highResolved?: boolean } = {}) {
    const highClean = opts.highResolved === true;
    return {
      juryPackage: {
        id: 'pkg-mixed',
        caseId,
        status: 'DRAFT',
        createdAt: new Date().toISOString(),
        finalizedAt: null,
        finalizedBy: null,
        finalizationRequestedAt: null,
        finalizationRequestedBy: null,
      },
      exhibits: [
        // HIGH — unresolved objection (P-7-shaped).
        {
          exhibitId: 'ex-high',
          exhibitLabel: 'P-7',
          currentStatus: 'ADMITTED',
          discrepancyStatus: highClean ? 'CLEAN' : 'FLAGGED',
          flags: highClean
            ? []
            : [
                {
                  ruleCode: 'UNRESOLVED_OBJECTION_JURY_ELIGIBLE',
                  status: 'OPEN',
                  label: 'Admitted while an objection is unresolved',
                },
              ],
          isSealed: false,
          status: 'INCLUDED',
          addedAt: new Date().toISOString(),
        },
        // MEDIUM — no custodian (P-6-shaped).
        {
          exhibitId: 'ex-medium',
          exhibitLabel: 'P-6',
          currentStatus: 'ADMITTED',
          discrepancyStatus: 'FLAGGED',
          flags: [
            {
              ruleCode: 'ADMITTED_NO_CUSTODIAN',
              status: 'OPEN',
              label: 'Admitted without a custodian on record',
            },
          ],
          isSealed: false,
          status: 'INCLUDED',
          addedAt: new Date().toISOString(),
        },
        // CLEAN baseline row.
        {
          exhibitId: 'ex-clean',
          exhibitLabel: 'P-4',
          currentStatus: 'ADMITTED',
          discrepancyStatus: 'CLEAN',
          flags: [],
          isSealed: false,
          status: 'INCLUDED',
          addedAt: new Date().toISOString(),
        },
      ],
    };
  }

  test('Blockers section renders HIGH + MEDIUM cards with the correct remediation pair; progress bar reflects clean/total', async ({
    page,
  }) => {
    await page.route('**/api/cases/**/jury-package', async (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mixedDraftBody('case-1')),
      });
    });
    // Resolve the HIGH row's objectionId (the Record-ruling trigger needs it).
    await page.route('**/api/cases/**/objections**', async (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { objectionId: 'obj-high', exhibitId: 'ex-high', status: 'UNRESOLVED' },
        ]),
      });
    });

    await page.goto('/jury-package');
    await switchRole(page, 'DEPUTY'); // DEPUTY can act on custody but not ruling

    await expect(page.getByTestId('jury-package-draft')).toBeVisible();

    // Two blocker cards, one clean row.
    await expect(page.getByTestId('jury-blocker-card')).toHaveCount(2);
    await expect(page.getByTestId('jury-clean-row')).toHaveCount(1);

    // Blockers heading counts 2; Clean heading counts 1.
    await expect(page.getByTestId('jury-blockers-section')).toContainText('Blockers (2)');
    await expect(page.getByTestId('jury-clean-section')).toContainText('Clean (1)');

    // Condition pills.
    const highCard = page.locator(
      '[data-testid="jury-blocker-card"][data-exhibit-label="P-7"]',
    );
    const mediumCard = page.locator(
      '[data-testid="jury-blocker-card"][data-exhibit-label="P-6"]',
    );
    await expect(highCard).toContainText('Unresolved objection');
    await expect(mediumCard).toContainText('No custodian on record');

    // MEDIUM offers Assign custodian (DEPUTY is a CUSTODY_ROLE); HIGH's Record
    // ruling trigger is absent for DEPUTY (JUDGE-only form) but the card still
    // renders with its Acknowledge secondary.
    await expect(mediumCard.getByTestId('jury-assign-custodian-trigger')).toBeVisible();
    await expect(highCard.getByTestId('jury-acknowledge-trigger')).toBeVisible();

    // Progress bar: 1 of 3 clean.
    await expect(page.getByTestId('two-color-progress-caption')).toContainText(
      '1 of 3 exhibits are clean',
    );
  });

  test('Record ruling on a HIGH blocker (JUDGE) resolves it → the card moves from Blockers to Clean on the next poll', async ({
    page,
  }) => {
    let ruled = false;

    await page.route('**/api/cases/**/jury-package', async (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mixedDraftBody('case-1', { highResolved: ruled })),
      });
    });
    await page.route('**/api/cases/**/objections**', async (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          ruled
            ? []
            : [{ objectionId: 'obj-high', exhibitId: 'ex-high', status: 'UNRESOLVED' }],
        ),
      });
    });
    await page.route('**/api/objections/*/ruling', async (route) => {
      ruled = true;
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ event: {}, objectionState: { status: 'RESOLVED' } }),
      });
    });

    await page.goto('/jury-package');
    await switchRole(page, 'JUDGE');

    const highCard = page.locator(
      '[data-testid="jury-blocker-card"][data-exhibit-label="P-7"]',
    );
    await expect(highCard).toBeVisible();

    // Expand the inline Record-ruling form (JUDGE-only), pick a disposition, confirm.
    await highCard.getByTestId('jury-record-ruling-trigger').click();
    await expect(page.getByTestId('record-ruling-form')).toBeVisible();
    // Carbon RadioButton: the native input is visually hidden behind the
    // __appearance span, so click the label rather than check() the input.
    await page.getByText('Overruled', { exact: true }).click();
    await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/ruling') && r.request().method() === 'POST',
      ),
      page.getByTestId('record-ruling-confirm').click(),
    ]);

    // Next poll re-reads server truth: the HIGH card leaves Blockers and the P-7
    // row appears in Clean.
    await expect(highCard).toHaveCount(0, { timeout: 10000 });
    await expect(
      page.locator('[data-testid="jury-clean-row"][data-exhibit-label="P-7"]'),
    ).toBeVisible({ timeout: 10000 });
  });

  test('Assign custodian on a MEDIUM blocker (DEPUTY) resolves it → the card moves from Blockers to Clean', async ({
    page,
    request,
  }) => {
    const caseRes = await request.get('/api/case');
    const { users } = await caseRes.json();
    const target = users.find((u: { role: string }) => u.role === 'CLERK') ?? users[0];

    let assigned = false;

    const body = () => {
      const b = mixedDraftBody('case-1');
      if (assigned) {
        // The MEDIUM row becomes clean once a custodian is assigned.
        const row = b.exhibits.find((e) => e.exhibitId === 'ex-medium')!;
        row.discrepancyStatus = 'CLEAN';
        row.flags = [];
      }
      return b;
    };

    await page.route('**/api/cases/**/jury-package', async (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(body()),
      });
    });
    await page.route('**/api/cases/**/objections**', async (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { objectionId: 'obj-high', exhibitId: 'ex-high', status: 'UNRESOLVED' },
        ]),
      });
    });
    await page.route('**/api/exhibits/*/events/custody', async (route) => {
      assigned = true;
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ event: {}, custodyState: {} }),
      });
    });

    await page.goto('/jury-package');
    await switchRole(page, 'DEPUTY');

    const mediumCard = page.locator(
      '[data-testid="jury-blocker-card"][data-exhibit-label="P-6"]',
    );
    await expect(mediumCard).toBeVisible();

    // Expand the inline Assign-custodian form, pick a custodian, confirm.
    await mediumCard.getByTestId('jury-assign-custodian-trigger').click();
    await expect(page.getByTestId('transfer-custody-form')).toBeVisible();
    // Open the Carbon Dropdown (the combobox toggle) WITHIN the custody form, then
    // pick the custodian from ITS listbox menu (scoped so the role-switcher <select>
    // options never match).
    const form = page.getByTestId('transfer-custody-form');
    await form.getByRole('combobox').click();
    await form.getByRole('option', { name: new RegExp(target.name) }).first().click();
    await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/events/custody') && r.request().method() === 'POST',
      ),
      page.getByTestId('transfer-custody-confirm').click(),
    ]);

    await expect(mediumCard).toHaveCount(0, { timeout: 10000 });
    await expect(
      page.locator('[data-testid="jury-clean-row"][data-exhibit-label="P-6"]'),
    ).toBeVisible({ timeout: 10000 });
  });

  test('a non-finalizing role sees "Request finalization from Clerk"; requesting it (200) surfaces the banner on a DEPUTY view of the same package', async ({
    page,
    request,
  }) => {
    const caseRes = await request.get('/api/case');
    const { users } = await caseRes.json();
    const judge = users.find((u: { role: string }) => u.role === 'JUDGE');

    // The package is clean (finalize-eligible) so the only thing gating finalize
    // is the ROLE — exactly the request-finalization scenario.
    let requested = false;
    const cleanBody = () => ({
      juryPackage: {
        id: 'pkg-req',
        caseId: 'case-1',
        status: 'DRAFT',
        createdAt: new Date().toISOString(),
        finalizedAt: null,
        finalizedBy: null,
        finalizationRequestedAt: requested ? new Date().toISOString() : null,
        finalizationRequestedBy: requested ? judge.id : null,
      },
      exhibits: [
        {
          exhibitId: 'ex-ok',
          exhibitLabel: 'P-4',
          currentStatus: 'ADMITTED',
          discrepancyStatus: 'CLEAN',
          flags: [],
          isSealed: false,
          status: 'INCLUDED',
          addedAt: new Date().toISOString(),
        },
      ],
    });

    await page.route('**/api/cases/**/jury-package', async (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(cleanBody()),
      });
    });
    await page.route('**/api/jury-package/*/request-finalization', async (route) => {
      requested = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    });

    await page.goto('/jury-package');
    await switchRole(page, 'JUDGE'); // a non-finalizing role

    // JUDGE sees the restricted copy + the Request-finalization control, NOT a
    // disabled Finalize button.
    await expect(page.getByTestId('jury-finalize-restricted')).toBeVisible();
    await expect(page.getByTestId('jury-finalize')).toHaveCount(0);
    const requestBtn = page.getByTestId('jury-request-finalization');
    await expect(requestBtn).toBeVisible();

    await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes('/request-finalization') && r.request().method() === 'POST',
      ),
      requestBtn.click(),
    ]);

    // Now switch to DEPUTY (a finalize-authorized role) — the banner naming the
    // requester renders above the Finalize control.
    await switchRole(page, 'DEPUTY');
    const banner = page.getByTestId('jury-finalization-requested-banner');
    await expect(banner).toBeVisible({ timeout: 10000 });
    await expect(banner).toContainText(judge.name);
    await expect(page.getByTestId('jury-finalize')).toBeVisible();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 09-10 / F25: full-width empty state + read-only readiness preview (every role)
  // ──────────────────────────────────────────────────────────────────────────

  test('F25: JUDGE sees a full-width empty state naming DEPUTY/CLERK/ADMIN + a read-only readiness preview listing seeded admitted exhibits; DEPUTY sees the IDENTICAL preview alongside the Start button', async ({
    page,
  }) => {
    // Force the read-only jury-package GET to report "no package yet" so the empty
    // state renders, independent of whether a prior run initiated the shared
    // package. CRITICAL: this mock must NOT intercept the sibling
    // /jury-package/preview endpoint (same path prefix) — the readiness panel must
    // hit LIVE seeded data so we prove real admitted exhibits render. Scope the
    // mock to requests whose path ENDS in /jury-package.
    await page.route('**/api/cases/**/jury-package', async (route) => {
      const url = new URL(route.request().url());
      if (!url.pathname.endsWith('/jury-package')) {
        await route.continue(); // let /jury-package/preview through to the server
        return;
      }
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

    await page.goto('/jury-package');

    // Default role is JUDGE (a non-initiating role). The empty state names who CAN
    // start a package and is restricted-copy (no Start button) for JUDGE.
    const empty = page.getByTestId('jury-package-empty');
    await expect(empty).toBeVisible();
    await expect(empty).toContainText('deputy, clerk, or administrator');
    await expect(page.getByTestId('jury-initiate-restricted')).toBeVisible();
    await expect(page.getByTestId('jury-initiate')).toHaveCount(0);

    // Full-width assertion: the empty-state container's bounding box is close to
    // <main>'s inner width (not a small centered card). Allow for <main>'s padding.
    const mainBox = await page.getByRole('main').boundingBox();
    const emptyBox = await empty.boundingBox();
    expect(mainBox).toBeTruthy();
    expect(emptyBox).toBeTruthy();
    // The panel should occupy most of the content width — within ~120px of <main>
    // (accounting for the 1.5rem padding on each side = 48px, plus margins).
    expect(emptyBox!.width).toBeGreaterThan(mainBox!.width - 120);

    // The readiness preview panel is ALSO visible (every state renders it) and
    // lists live seeded admitted exhibits with their ready/blocked status.
    const preview = page.getByTestId('jury-readiness-preview');
    await expect(preview).toBeVisible();
    // At least one seeded admitted exhibit row is listed (seed admits ≥2 clean +
    // P-6 no-custodian + P-7 unresolved-objection + 1 sealed visible to JUDGE).
    // Wait for a row first (the /preview route cold-compiles in dev on first hit).
    await expect(page.getByTestId('jury-readiness-row').first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('jury-readiness-summary')).toBeVisible();
    const rowCount = await page.getByTestId('jury-readiness-row').count();
    expect(rowCount).toBeGreaterThan(0);
    // A blocked row shows a blocker detail; a ready row shows ✓ Ready. At least
    // one of each is present in the seed (P-6/P-7 blocked; clean exhibits ready).
    await expect(page.getByTestId('jury-readiness-ready').first()).toBeVisible();

    // Capture the JUDGE-visible row count so we can confirm DEPUTY sees the SAME
    // read-only panel (not a different "with actions" variant). DEPUTY cannot view
    // sealed exhibits, so its visible set may differ by the sealed row only — the
    // KEY assertion is the panel renders identically read-only with zero actions.
    await switchToDeputy(page);

    // The empty state now shows the Start button (DEPUTY is an INITIATE_ROLE).
    await expect(page.getByTestId('jury-initiate')).toBeVisible();

    // The IDENTICAL read-only readiness panel still renders — same testid, still
    // visible, still has NO action buttons/links inside it.
    const previewAsDeputy = page.getByTestId('jury-readiness-preview');
    await expect(previewAsDeputy).toBeVisible();
    await expect(page.getByTestId('jury-readiness-row').first()).toBeVisible({ timeout: 10000 });
    // The preview panel contains no <button> and no <a> — it is deliberately inert
    // (F25: "there is no preview-with-actions variant").
    await expect(previewAsDeputy.locator('button')).toHaveCount(0);
    await expect(previewAsDeputy.locator('a')).toHaveCount(0);
  });

  test('a finalize-authorized role requesting finalization directly via the API is rejected 403 (server-enforced, bypassing the UI)', async ({
    request,
  }) => {
    // The UI never offers a finalize-authorized role the request control — but the
    // server is the authority. Drive a REAL request as a DEPUTY against the live
    // endpoint and prove the inverted role gate (08-01) 403s it.
    const caseRes = await request.get('/api/case');
    const { case: kase, users } = await caseRes.json();
    const deputy = users.find((u: { role: string }) => u.role === 'DEPUTY');

    // Ensure a DRAFT package exists to request against (initiate is idempotent).
    await request.post(`/api/cases/${kase.id}/jury-package`, {
      headers: { 'Content-Type': 'application/json', 'X-User-Role': 'DEPUTY' },
      data: { actorUserId: deputy.id },
    });
    const pkgRes = await request.get(`/api/cases/${kase.id}/jury-package`, {
      headers: { 'X-User-Role': 'DEPUTY' },
    });
    const { juryPackage } = await pkgRes.json();

    // A living DRAFT is required for this proof; a prior run may have finalized the
    // shared package. If so, the 403 role-gate is still proven by the service's
    // ordering test (juryPackage.test.ts) — skip rather than assert a false 409.
    test.skip(
      !juryPackage || juryPackage.status !== 'DRAFT',
      'shared package is not in DRAFT state this run',
    );

    const res = await request.post(
      `/api/jury-package/${juryPackage.id}/request-finalization`,
      {
        headers: { 'Content-Type': 'application/json', 'X-User-Role': 'DEPUTY' },
        data: { actorUserId: deputy.id },
      },
    );
    expect(res.status()).toBe(403);
    const err = await res.json();
    expect(JSON.stringify(err)).toContain('ROLE_NOT_PERMITTED');
  });
});
