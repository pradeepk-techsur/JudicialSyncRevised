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

async function switchToDeputy(page: Page): Promise<void> {
  const roleSelect = page.getByLabel('Switch active role');
  await expect(roleSelect).toBeEnabled();
  const deputyOption = roleSelect.locator('option', { hasText: 'DEPUTY' });
  await roleSelect.selectOption((await deputyOption.getAttribute('value')) as string);
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

    // The one OPEN-flagged row hard-disables the Finalize button.
    const blockingRows = page.locator('[data-testid="jury-exhibit-row"][data-blocking="true"]');
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
});
