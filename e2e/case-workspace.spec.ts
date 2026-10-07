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
});
