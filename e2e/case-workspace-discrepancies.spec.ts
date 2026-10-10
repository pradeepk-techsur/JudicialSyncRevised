import { test, expect } from '@playwright/test';

// Browse-screen flag surfacing (F6/F9, US-9.2 "visible without drill-in").
//
// Phase 8 (08-11) redesigns the Case Workspace Flags column: the icon-only
// `DiscrepancyBadge` (data-testid="discrepancy-badge") is REPLACED by the shared
// readable `SeverityPill` (data-testid="severity-pill"), which surfaces the full
// condition set — discrepancy flags PLUS the two additive 08-07 signals
// (hasUnresolvedObjection → "Ruling pending", isSealed → "Ex parte · restricted").
//
// This spec asserts that redesign against LIVE seeded data. The Phase-8 seed adds
// two legacy-admit fixtures that DO carry open flags: P-6 (ADMITTED, no custodian
// → "No custodian") and P-7 (ADMITTED, unresolved objection → "Open objection").
// So — unlike the Phase-7 era — open-toned pills now legitimately appear; the
// assertions below verify the correct pill renders for a known fixture and that a
// genuinely clean exhibit shows none.

test.describe('Case Workspace — readable flag pills', () => {
  test('the obsolete icon-only discrepancy badge is gone (replaced by SeverityPill)', async ({
    page,
  }) => {
    await page.goto('/case');
    await expect(page.getByText('P-1')).toBeVisible(); // sanity: list loaded
    // The old component is removed everywhere on this screen.
    await expect(page.locator('[data-testid="discrepancy-badge"]')).toHaveCount(0);
  });

  test('P-6 (legacy admit, no custodian) shows a readable "No custodian" flag pill', async ({
    page,
  }) => {
    await page.goto('/case');
    const row = page.locator('[data-testid="exhibit-row"][data-exhibit-label="P-6"]');
    await expect(row).toBeVisible();
    const pill = row.locator('[data-testid="severity-pill"]', { hasText: 'No custodian' });
    await expect(pill).toBeVisible();
  });

  test('P-7 (legacy admit, unresolved objection) shows a readable "Open objection" flag pill', async ({
    page,
  }) => {
    await page.goto('/case');
    const row = page.locator('[data-testid="exhibit-row"][data-exhibit-label="P-7"]');
    await expect(row).toBeVisible();
    const pill = row.locator('[data-testid="severity-pill"]', { hasText: 'Open objection' });
    await expect(pill).toBeVisible();
  });

  test('P-4 (clean admitted exhibit) shows NO flag pill', async ({ page }) => {
    await page.goto('/case');
    const row = page.locator('[data-testid="exhibit-row"][data-exhibit-label="P-4"]');
    await expect(row).toBeVisible();
    await expect(row.locator('[data-testid="severity-pill"]')).toHaveCount(0);
  });

  test('P-2 (admission-blocked) still navigates to Exhibit Detail on row click', async ({
    page,
  }) => {
    await page.goto('/case');
    const row = page.locator('[data-testid="exhibit-row"][data-exhibit-label="P-2"]');
    await expect(row).toBeVisible();
    await row.click();
    await expect(page).toHaveURL(/\/exhibit\/[0-9a-f-]+/);
  });
});
