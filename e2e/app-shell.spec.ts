import { test, expect } from '@playwright/test';

test.describe('App shell', () => {
  test('home redirects to /case', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/case$/);
  });

  test('header shows the seeded case number and defaults the role switcher to a JUDGE persona', async ({ page }) => {
    await page.goto('/case');
    await expect(page.getByText(/Case: 2026-CR-0142/)).toBeVisible();
    const select = page.getByLabel('Switch active role');
    await expect(select).toBeVisible();
    const selectedLabel = await select.locator('option:checked').textContent();
    expect(selectedLabel).toMatch(/JUDGE/);
  });

  test('role switcher lists all 6 seeded personas and switching updates the active role', async ({ page }) => {
    await page.goto('/case');
    const select = page.getByLabel('Switch active role');
    // The roster is populated asynchronously after the shell's one-time
    // GET /api/case bootstrap resolves — wait on the retrying count assertion
    // before reading option text, otherwise we race the hydration.
    await expect(select.locator('option')).toHaveCount(6);
    const optionTexts = await select.locator('option').allTextContents();
    expect(optionTexts.join(' ')).toMatch(/ATTORNEY/);

    const attorneyOption = select.locator('option', { hasText: 'ATTORNEY' });
    const attorneyValue = await attorneyOption.getAttribute('value');
    await select.selectOption(attorneyValue!);
    const selectedLabel = await select.locator('option:checked').textContent();
    expect(selectedLabel).toMatch(/ATTORNEY/);
  });

  test('Ask button is present and disabled', async ({ page }) => {
    await page.goto('/case');
    const askButton = page.getByRole('button', { name: 'Ask ✦' });
    await expect(askButton).toBeDisabled();
  });

  test('sidebar shows Case Workspace as a live link and the other three items as disabled placeholders', async ({ page }) => {
    await page.goto('/case');
    const nav = page.getByRole('navigation', { name: 'Main navigation' });
    await expect(nav.getByRole('link', { name: 'Case Workspace' })).toBeVisible();
    await expect(nav.getByText('Command Center')).toHaveAttribute('aria-disabled', 'true');
    await expect(nav.getByText('Jury Package')).toHaveAttribute('aria-disabled', 'true');
    await expect(nav.getByText('Assistant')).toHaveAttribute('aria-disabled', 'true');
  });

  test('landmark roles are present', async ({ page }) => {
    await page.goto('/case');
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
    await expect(page.getByRole('main')).toBeVisible();
  });
});
