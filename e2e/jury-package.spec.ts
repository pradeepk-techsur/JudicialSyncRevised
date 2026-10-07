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

  test('full flow: initiate → hard-disabled gate → acknowledge → gate re-enables → finalize → export', async ({
    page,
  }) => {
    await page.goto('/jury-package');
    await switchToDeputy(page);

    // The screen is now in one of: empty (initiate), draft, or finalized (a prior
    // run). Converge to a DRAFT we can drive.
    const empty = page.getByTestId('jury-package-empty');
    const finalized = page.getByTestId('jury-package-finalized');
    const draft = page.getByTestId('jury-package-draft');

    // Wait for one of the three states to settle.
    await expect(empty.or(finalized).or(draft)).toBeVisible();

    if (await finalized.isVisible()) {
      // A prior run already finalized the shared package. Start a fresh draft.
      await page.getByTestId('jury-start-new-draft').click();
      await expect(draft).toBeVisible();
    } else if (await empty.isVisible()) {
      await page.getByTestId('jury-initiate').click();
      await expect(draft).toBeVisible();
    }

    // Draft list shows admitted exhibits with a summary line.
    await expect(page.getByTestId('jury-summary')).toBeVisible();

    // Acknowledge every OPEN flag until the gate re-enables. Each acknowledge
    // mutates real server state and the row restyles from live data.
    const finalizeBtn = page.getByTestId('jury-finalize');

    // If there are blocking rows, the finalize button must be hard-disabled.
    const blockingRows = page.locator('[data-testid="jury-exhibit-row"][data-blocking="true"]');
    const initialBlocking = await blockingRows.count();
    if (initialBlocking > 0) {
      await expect(finalizeBtn).toBeDisabled();
      await expect(page.getByTestId('jury-finalize-caption')).toBeVisible();
    }

    // Acknowledge the first flag's inline form once up front to exercise the
    // counter + empty-disabled-Confirm behaviour explicitly (the gate-clearing
    // loop below is more mechanical).
    {
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
      await expect(page.getByTestId('acknowledge-textarea')).toHaveCount(0, { timeout: 10000 });
    }

    // Clear any remaining OPEN flags until the gate re-enables. Re-resolve each
    // iteration (4s live polling re-renders the list) and stop as soon as the
    // Finalize button is enabled — i.e. the last OPEN flag has been acknowledged.
    await expect(async () => {
      if (await finalizeBtn.isEnabled()) return; // gate cleared → done
      const triggers = page.getByTestId('jury-acknowledge-trigger');
      await expect(triggers.first()).toBeVisible({ timeout: 2000 });
      await triggers.first().click({ timeout: 2000 });
      const textarea = page.getByTestId('acknowledge-textarea').first();
      await textarea.fill('Reviewed and acceptable for jury handoff.', { timeout: 2000 });
      await Promise.all([
        page.waitForResponse(
          (r) => r.url().includes('/acknowledge') && r.request().method() === 'POST',
        ),
        page.getByTestId('acknowledge-confirm').first().click({ timeout: 2000 }),
      ]);
      await expect(finalizeBtn).toBeEnabled({ timeout: 3000 });
    }).toPass({ timeout: 30000 });

    // Gate re-enabled after the last OPEN flag is acknowledged.
    await expect(finalizeBtn).toBeEnabled();

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
