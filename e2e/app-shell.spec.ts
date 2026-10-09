import { test, expect } from '@playwright/test';

test.describe('App shell', () => {
  test('home redirects to /command-center', async ({ page }) => {
    // Phase 5 (05-03) made the Command Center the default landing — / now
    // redirects to /command-center (was /case).
    await page.goto('/');
    await expect(page).toHaveURL(/\/command-center$/);
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

  test('sidebar shows Command Center (first), Case Workspace, Jury Package and Assistant as live links', async ({ page }) => {
    await page.goto('/case');
    const nav = page.getByRole('navigation', { name: 'Main navigation' });
    // Phase 5 (05-03) activated Command Center as the FIRST live nav item — there
    // is no longer any disabled placeholder.
    await expect(nav.getByRole('link').first()).toHaveText(/Command Center/);
    await expect(nav.getByRole('link', { name: 'Command Center' })).toHaveAttribute(
      'href',
      '/command-center',
    );
    // Phase 2 + Phase 3 + Phase 4 live routes preserved (non-regression).
    await expect(nav.getByRole('link', { name: 'Case Workspace' })).toBeVisible();
    await expect(nav.getByRole('link', { name: /Jury Package/ })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Assistant' })).toHaveAttribute('href', '/assistant');
  });

  test('landmark roles are present', async ({ page }) => {
    await page.goto('/case');
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
    await expect(page.getByRole('main')).toBeVisible();
  });

  test('header discrepancy-count indicator is absent when the open count is zero (default seed)', async ({ page }) => {
    await page.goto('/case');
    // Plan 07-02's seed produces zero exhibits with an OPEN discrepancy flag —
    // the indicator must be completely absent, not rendered-and-hidden.
    await expect(page.getByTestId('header-discrepancy-indicator')).toHaveCount(0);
  });

  test('header discrepancy-count indicator renders with an accessible label and navigates on click when the count is nonzero', async ({ page }) => {
    // Acknowledging a discrepancy does not clear the OPEN count on its own —
    // there is no organic OPEN flag in the default seed post-F12 (plan 07-02).
    // Mock the discrepancies endpoint to force a nonzero count for this UI-only
    // assertion, mirroring the mocking pattern already used elsewhere in this
    // suite (e.g. jury-package.spec.ts's role-gating test).
    await page.route('**/api/cases/**/discrepancies', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'flag-1', caseId: 'case-1', exhibitId: 'ex-1', ruleCode: 'ADMITTED_NO_CUSTODIAN', status: 'OPEN', detectedAt: new Date().toISOString(), details: {}, acknowledgedAt: null, acknowledgedBy: null, resolvedAt: null },
        ]),
      });
    });
    await page.goto('/case');
    const indicator = page.getByTestId('header-discrepancy-indicator');
    await expect(indicator).toBeVisible();
    await expect(indicator).toHaveAccessibleName('1 open discrepancies');
    await indicator.click();
    await expect(page).toHaveURL(/\/command-center/);
  });
});
