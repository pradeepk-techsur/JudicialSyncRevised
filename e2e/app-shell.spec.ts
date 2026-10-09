import { test, expect } from '@playwright/test';

test.describe('App shell', () => {
  test('home redirects to /command-center', async ({ page }) => {
    // Phase 5 (05-03) made the Command Center the default landing — / now
    // redirects to /command-center (was /case).
    await page.goto('/');
    await expect(page).toHaveURL(/\/command-center$/);
  });

  test('role switcher defaults to a JUDGE persona', async ({ page }) => {
    // Phase 8 (08-04) removed the raw case-number text node from the shared
    // header entirely (it now lives in each screen's own subtitle, per the
    // reference screenshots) — so this test asserts ONLY the still-true
    // role-switcher-defaults-to-JUDGE behavior.
    await page.goto('/case');
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

  test('Ask Pivota button is present and enabled (Phase 4 activates the assistant panel)', async ({ page }) => {
    await page.goto('/case');
    // The button's accessible name is its aria-label ("Open Pivota Assistant");
    // its visible text is "Ask Pivota" (relabeled from "Ask ✦" in Phase 8, 08-04).
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

  test('sidebar never visually overlaps the shared header (Phase 8 gap 2 — 08-UAT.md test 2)', async ({ page }) => {
    await page.goto('/case');
    const header = page.locator('header[aria-label="JudicialSync"]');
    const nav = page.getByRole('navigation', { name: 'Main navigation' });
    await expect(header).toBeVisible();
    await expect(nav).toBeVisible();

    const headerBox = await header.boundingBox();
    const navBox = await nav.boundingBox();
    expect(headerBox).not.toBeNull();
    expect(navBox).not.toBeNull();
    // The sidebar must start at or below the header's bottom edge — i.e. zero
    // vertical overlap between the two fixed-position panels.
    expect(navBox!.y).toBeGreaterThanOrEqual(headerBox!.y + headerBox!.height - 1);

    // Stronger check: hit-test the role-switcher's actual center point and
    // confirm the sidebar (not some other element) isn't intercepting it —
    // this is the precise failure mode the user reported ("overlaps the
    // persona dropdown").
    const roleSelect = page.getByLabel('Switch active role');
    const selectBox = await roleSelect.boundingBox();
    expect(selectBox).not.toBeNull();
    const centerX = selectBox!.x + selectBox!.width / 2;
    const centerY = selectBox!.y + selectBox!.height / 2;
    const topElementTag = await page.evaluate(
      ({ x, y }) => {
        const el = document.elementFromPoint(x, y);
        return el ? el.closest('select')?.id ?? el.tagName : null;
      },
      { x: centerX, y: centerY },
    );
    expect(topElementTag).toBe('role-switcher');
  });

  test('header never renders a discrepancy-count indicator (moved to Command Center stat cards/attention feed, Phase 8)', async ({ page }) => {
    // Phase 8 (08-04) removed the discrepancy-count badge from the shared header
    // ENTIRELY — in any state. The discrepancy signal now lives in the Command
    // Center's stat-card row / "Needs your attention" feed (08-CONTEXT §Header
    // layout). To prove the removal is unconditional (not merely zero-count
    // hiding), force the underlying count NONZERO via the same discrepancies
    // route-mock the old design's test used — the indicator must STILL be absent.
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
    // Even with a nonzero mocked count, the header has no such element at all.
    await expect(page.getByTestId('header-discrepancy-indicator')).toHaveCount(0);
  });
});
