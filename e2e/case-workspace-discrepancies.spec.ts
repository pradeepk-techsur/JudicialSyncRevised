import { test, expect } from '@playwright/test';

// Browse-screen discrepancy surfacing (F6/F9, US-9.2 "visible without drill-in").
// The seeded demo case (2026-CR-0142) fires both rules out of the box via the
// live engine:
//   P-2 — ADMITTED with no custodian  → amber "No custodian on record"
//   P-3 — ADMITTED with unresolved objection → amber "Unresolved objection"
//   P-4 — cleanly ADMITTED, full custody chain, no open objection → no badge
// Default role is JUDGE (full visibility). The badge text is always visible
// (never icon-only), and clicking a flagged row still drills into Exhibit Detail
// (acknowledge is not inline on the browse screen).

test.describe('Case Workspace — discrepancy badges', () => {
  test('P-2 (custody gap) shows an amber "No custodian on record" badge with visible text', async ({
    page,
  }) => {
    await page.goto('/case');
    const row = page.locator('[data-testid="exhibit-row"][data-exhibit-label="P-2"]');
    await expect(row).toBeVisible();

    const badge = row.locator('[data-testid="discrepancy-badge"]');
    await expect(badge).toBeVisible();
    // Plain-language text is visible, not just an icon.
    await expect(badge).toContainText('No custodian on record');
    await expect(badge).toHaveAttribute('data-discrepancy-status', 'OPEN');
  });

  test('P-3 (unresolved objection) shows an "Unresolved objection" badge', async ({ page }) => {
    await page.goto('/case');
    const row = page.locator('[data-testid="exhibit-row"][data-exhibit-label="P-3"]');
    await expect(row).toBeVisible();

    const badge = row.locator('[data-testid="discrepancy-badge"]');
    await expect(badge).toBeVisible();
    await expect(badge).toContainText('Unresolved objection');
    await expect(badge).toHaveAttribute('data-discrepancy-status', 'OPEN');
  });

  test('P-4 (clean admitted exhibit) shows NO discrepancy badge', async ({ page }) => {
    await page.goto('/case');
    const row = page.locator('[data-testid="exhibit-row"][data-exhibit-label="P-4"]');
    await expect(row).toBeVisible();
    await expect(row.locator('[data-testid="discrepancy-badge"]')).toHaveCount(0);
  });

  test('clicking a flagged row navigates to its Exhibit Detail (acknowledge is not inline)', async ({
    page,
  }) => {
    await page.goto('/case');
    const row = page.locator('[data-testid="exhibit-row"][data-exhibit-label="P-2"]');
    await expect(row).toBeVisible();
    await row.click();
    await expect(page).toHaveURL(/\/exhibit\/[0-9a-f-]+/);
  });
});
