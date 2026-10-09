import { test, expect } from '@playwright/test';

// Browse-screen discrepancy surfacing (F6/F9, US-9.2 "visible without drill-in").
// F12 (Phase 7) makes it structurally impossible for ANY exhibit to carry an
// open discrepancy flag in fresh seed data (the admission gate now blocks the
// exact preconditions F6's two rules key off, before an ADMITTED state can ever
// exist with either precondition true). This spec now asserts that structural
// guarantee directly, plus the still-valid "clean exhibit shows no badge" and
// "row still navigates" behaviors. F6's rule-engine VISUAL rendering (the badge
// component itself, OPEN vs ACKNOWLEDGED styling) remains covered at the unit
// level by DiscrepancyBadge's own tests and by discrepancies.test.ts's
// white-box fixtures — this file is specifically about the Case Workspace's
// LIVE, seeded-data integration, which can no longer exhibit an OPEN badge.

test.describe('Case Workspace — discrepancy badges', () => {
  test('no exhibit row anywhere shows an open discrepancy badge (F12 structural guarantee)', async ({
    page,
  }) => {
    await page.goto('/case');
    await expect(page.getByText('P-1')).toBeVisible(); // sanity: list loaded
    const openBadges = page.locator('[data-testid="discrepancy-badge"][data-discrepancy-status="OPEN"]');
    await expect(openBadges).toHaveCount(0);
  });

  test('P-4 (clean admitted exhibit) shows NO discrepancy badge', async ({ page }) => {
    await page.goto('/case');
    const row = page.locator('[data-testid="exhibit-row"][data-exhibit-label="P-4"]');
    await expect(row).toBeVisible();
    await expect(row.locator('[data-testid="discrepancy-badge"]')).toHaveCount(0);
  });

  test('P-2 (admission-blocked, no open badge) still navigates to Exhibit Detail on row click', async ({
    page,
  }) => {
    await page.goto('/case');
    const row = page.locator('[data-testid="exhibit-row"][data-exhibit-label="P-2"]');
    await expect(row).toBeVisible();
    await row.click();
    await expect(page).toHaveURL(/\/exhibit\/[0-9a-f-]+/);
  });
});
