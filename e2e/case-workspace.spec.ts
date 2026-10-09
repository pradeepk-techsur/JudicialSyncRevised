import { test, expect } from '@playwright/test';

test.describe('Case Workspace', () => {
  test('default view shows every unsealed exhibit with status, party, witness, custodian', async ({
    page,
  }) => {
    await page.goto('/case');
    await expect(page.getByText('P-1')).toBeVisible();
    const row = page.locator('[data-testid="exhibit-row"][data-exhibit-label="P-1"]');
    await expect(row).toContainText('PROSECUTION');
    await expect(row.getByText('Objected')).toBeVisible(); // P-1 seeded to OBJECTED, unresolved objection
  });

  test('JUDGE role sees the sealed exhibit; switching to ATTORNEY hides it with no redacted placeholder', async ({
    page,
  }) => {
    await page.goto('/case');
    await expect(page.getByText('S-1')).toBeVisible();

    const roleSelect = page.getByLabel('Switch active role');
    const attorneyOption = roleSelect.locator('option', { hasText: 'ATTORNEY' });
    await roleSelect.selectOption((await attorneyOption.getAttribute('value')) as string);

    await expect(page.getByText('S-1')).not.toBeVisible();
    // No "1 hidden result" / redacted row indicator of any kind:
    await expect(page.getByText(/hidden/i)).toHaveCount(0);
  });

  test('combinable AND search narrows results; clearing filters restores the full list', async ({
    page,
  }) => {
    await page.goto('/case');
    await page.getByLabel('Filter by witness').fill('Finch');
    await expect(page.getByText('P-3')).toBeVisible();
    await expect(page.getByText('P-1')).not.toBeVisible();

    // AND with a non-matching status narrows to zero.
    await page.getByLabel('Filter by status').click();
    await page.getByRole('option', { name: 'MARKED' }).click();
    await expect(page.getByText('No exhibits match these filters.')).toBeVisible();

    await page.getByRole('button', { name: 'Clear filters' }).click();
    await expect(page.getByText('P-1')).toBeVisible();
    await expect(page.getByText('P-3')).toBeVisible();
  });

  test('empty search bar shows an inline hint, never a hard error', async ({ page }) => {
    await page.goto('/case');
    await expect(page.getByText(/Enter at least one filter/i)).toBeVisible();
    await expect(page.getByText('P-1')).toBeVisible(); // full list still showing, not an error page
  });

  test('clicking a row navigates to its Exhibit Detail View', async ({ page }) => {
    await page.goto('/case');
    await page.locator('[data-testid="exhibit-row"][data-exhibit-label="P-1"]').click();
    await expect(page).toHaveURL(/\/exhibit\/[0-9a-f-]+/);
  });

  // F15 item 1: the ENTIRE row area must be clickable, not just a nested
  // element and not just Playwright's default dead-center click. Uses P-4 — a
  // stable, always-ADMITTED, always-present clean exhibit (plan 07-02 seed) —
  // to stay independent of any particular status/discrepancy state.
  test('entire row area is clickable, not just a nested element', async ({ page }) => {
    await page.goto('/case');
    const row = page.locator('[data-testid="exhibit-row"][data-exhibit-label="P-4"]');
    await expect(row).toBeVisible();
    const box = await row.boundingBox();
    if (!box) throw new Error('row has no bounding box');
    // Click near the far-left edge (Label cell) and far-right edge (last cell)
    // of the row — not just Playwright's default dead-center click.
    await page.mouse.click(box.x + 5, box.y + box.height / 2);
    await expect(page).toHaveURL(/\/exhibit\/[0-9a-f-]+/);
    await page.goBack();
    const row2 = page.locator('[data-testid="exhibit-row"][data-exhibit-label="P-4"]');
    const box2 = await row2.boundingBox();
    if (!box2) throw new Error('row has no bounding box on second pass');
    await page.mouse.click(box2.x + box2.width - 5, box2.y + box2.height / 2);
    await expect(page).toHaveURL(/\/exhibit\/[0-9a-f-]+/);
  });

  // F15 item 1 (threat T-07-08): keyboard parity — Tab-focus + Enter navigates
  // a row identically to a click.
  test('row is keyboard-activatable: Tab to focus, Enter navigates', async ({ page }) => {
    await page.goto('/case');
    const row = page.locator('[data-testid="exhibit-row"][data-exhibit-label="P-4"]');
    await row.focus();
    await expect(row).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/exhibit\/[0-9a-f-]+/);
  });
});
