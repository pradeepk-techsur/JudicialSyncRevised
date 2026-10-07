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

  test('Ask ✦ button is present and enabled (Phase 4 activates the assistant panel)', async ({ page }) => {
    await page.goto('/case');
    // The button's accessible name is its aria-label ("Open Pivota Assistant");
    // its visible text is "Ask ✦".
    const askButton = page.getByTestId('ask-assistant');
    await expect(askButton).toBeEnabled();
    await expect(askButton).toHaveText(/Ask/);
    // Clicking it opens the global slide-over panel over the current screen.
    await askButton.click();
    await expect(page.getByTestId('assistant-panel')).toHaveAttribute('data-open', 'true');
  });

  test('sidebar shows Case Workspace, Jury Package and Assistant as live links, Command Center as the sole disabled placeholder', async ({ page }) => {
    await page.goto('/case');
    const nav = page.getByRole('navigation', { name: 'Main navigation' });
    // Phase 2 + Phase 3 + Phase 4 live routes.
    await expect(nav.getByRole('link', { name: 'Case Workspace' })).toBeVisible();
    await expect(nav.getByRole('link', { name: /Jury Package/ })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Assistant' })).toHaveAttribute('href', '/assistant');
    // Phase 5 remains the sole disabled placeholder.
    await expect(nav.getByText('Command Center')).toHaveAttribute('aria-disabled', 'true');
  });

  test('landmark roles are present', async ({ page }) => {
    await page.goto('/case');
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
    await expect(page.getByRole('main')).toBeVisible();
  });
});
