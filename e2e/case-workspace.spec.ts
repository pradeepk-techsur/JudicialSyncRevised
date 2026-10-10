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

  // ---- Phase 8 (08-11) Case Workspace redesign ----

  // Jury Package column (F09 §Process step 3): server-computed, plain-language
  // colored text, rendered ONLY for ADMITTED rows. P-6 is legacy-ADMITTED; the
  // demo seed computes no JuryPackage, so P-6 (admitted, unsealed, no member
  // row) reads the Phase-9 "Not yet evaluated" value — the corrected replacement
  // for Phase 8's incorrect always-"Not eligible". We assert the column renders a
  // recognized plain-language value carried verbatim from the server.
  test('Jury Package column renders server-computed plain-language text for an admitted row', async ({
    page,
  }) => {
    await page.goto('/case');
    const row = page.locator('[data-testid="exhibit-row"][data-exhibit-label="P-6"]');
    await expect(row).toBeVisible();
    const cell = row.locator('[data-testid="jury-package-eligibility"]');
    await expect(cell).toBeVisible();
    await expect(cell).toHaveText(/Included|Not eligible|Blocked|Not yet evaluated/);
    // The value is carried by a data attribute reflecting the server verbatim.
    await expect(cell).toHaveAttribute(
      'data-eligibility',
      /INCLUDED|NOT_ELIGIBLE|BLOCKED|NOT_YET_EVALUATED/,
    );
  });

  // Phase 9 (F09 §Process step 4): a NON-admitted exhibit renders NO eligibility
  // tag at all — the service still returns a value, the UI suppresses it. P-1 is
  // seeded OBJECTED (never admitted).
  test('a non-admitted exhibit renders NO jury-package eligibility tag', async ({ page }) => {
    await page.goto('/case');
    const row = page.locator('[data-testid="exhibit-row"][data-exhibit-label="P-1"]');
    await expect(row).toBeVisible();
    // Sanity-check P-1 is indeed not admitted (Objected badge present).
    await expect(row.getByText('Objected')).toBeVisible();
    // The eligibility tag is entirely absent (not merely empty text).
    await expect(row.locator('[data-testid="jury-package-eligibility"]')).toHaveCount(0);
  });

  // Phase 9 (F09 §Process step 4): an ADMITTED exhibit with no jury package ever
  // computed for the case reads "Not yet evaluated" — NOT "Not eligible". P-4 is
  // seeded ADMITTED + clean; the demo seed computes no JuryPackage.
  test('an admitted exhibit with no computed package shows "Not yet evaluated", not "Not eligible"', async ({
    page,
  }) => {
    await page.goto('/case');
    const row = page.locator('[data-testid="exhibit-row"][data-exhibit-label="P-4"]');
    await expect(row).toBeVisible();
    const cell = row.locator('[data-testid="jury-package-eligibility"]');
    await expect(cell).toBeVisible();
    await expect(cell).toHaveAttribute('data-eligibility', 'NOT_YET_EVALUATED');
    await expect(cell).toHaveText('Not yet evaluated');
  });

  // Unassigned custodian → red "Unassigned" text, never a blank cell
  // (Screenshot 5). P-6 (legacy admit, zero custody) is the canonical fixture.
  test('an exhibit with no custodian shows red "Unassigned" text, not a blank cell', async ({
    page,
  }) => {
    await page.goto('/case');
    const row = page.locator('[data-testid="exhibit-row"][data-exhibit-label="P-6"]');
    await expect(row).toBeVisible();
    await expect(row.getByText('Unassigned', { exact: true })).toBeVisible();
  });

  // Quick-filter chips narrow the rendered rows client-side with live counts.
  test('quick-filter chips narrow the rendered rows and carry live counts', async ({ page }) => {
    await page.goto('/case');
    await expect(page.getByText('P-1')).toBeVisible();

    const all = page.getByTestId('quick-filter-all');
    const needs = page.getByTestId('quick-filter-needs-attention');
    await expect(all).toBeVisible();
    await expect(needs).toBeVisible();

    // "All" is active by default.
    await expect(all).toHaveAttribute('aria-pressed', 'true');

    // Each chip shows a numeric count; "All" counts every loaded row.
    await expect(all).toContainText(/\d/);
    await expect(needs).toContainText(/\d/);

    const allRows = page.locator('[data-testid="exhibit-row"]');
    const totalBefore = await allRows.count();
    expect(totalBefore).toBeGreaterThan(0);

    // Narrow to "Needs attention": P-6/P-7 (flagged) remain; the clean P-4 drops.
    await needs.click();
    await expect(needs).toHaveAttribute('aria-pressed', 'true');
    await expect(all).toHaveAttribute('aria-pressed', 'false');
    await expect(
      page.locator('[data-testid="exhibit-row"][data-exhibit-label="P-6"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="exhibit-row"][data-exhibit-label="P-4"]'),
    ).toHaveCount(0);
    const totalNeeds = await page.locator('[data-testid="exhibit-row"]').count();
    expect(totalNeeds).toBeLessThan(totalBefore);

    // Back to "All" restores the full list.
    await all.click();
    await expect(page.locator('[data-testid="exhibit-row"]')).toHaveCount(totalBefore);
  });

  // Footer caption (Screenshot 5).
  test('footer caption is present below the table', async ({ page }) => {
    await page.goto('/case');
    await expect(
      page.getByText('Tinted rows need attention. Select any row to open the exhibit.'),
    ).toBeVisible();
  });

  // Phase 9 (T-06): "Add exhibit" is role-gated to DEPUTY/CLERK/ADMIN — ABSENT
  // (not merely disabled) for every other role. The underlying button, when
  // shown, remains the deliberate disabled-placeholder (exhibit creation is still
  // out of scope). The default role is JUDGE, so the button is absent on load.
  test('"Add exhibit" is absent for JUDGE (default) and for every non-permitted role', async ({
    page,
  }) => {
    await page.goto('/case');
    // Default role JUDGE: button absent.
    await expect(page.getByTestId('add-exhibit-button')).toHaveCount(0);

    const roleSelect = page.getByLabel('Switch active role');
    for (const role of ['ATTORNEY', 'CHAMBERS_STAFF'] as const) {
      // Match the role in parentheses — the option text is "Name (ROLE)", and a
      // bare "CLERK" would also match "Chambers Clerk (CHAMBERS_STAFF)".
      const option = roleSelect.locator('option', { hasText: `(${role})` });
      const value = await option.getAttribute('value');
      // Not every seed necessarily has all roles; skip if the option is missing.
      if (!value) continue;
      await roleSelect.selectOption(value);
      await expect(
        page.getByTestId('add-exhibit-button'),
        `Add exhibit must be absent for ${role}`,
      ).toHaveCount(0);
    }
  });

  test('"Add exhibit" is present (and a disabled placeholder) for DEPUTY/CLERK/ADMIN', async ({
    page,
  }) => {
    await page.goto('/case');
    const roleSelect = page.getByLabel('Switch active role');
    let sawAtLeastOne = false;
    for (const role of ['DEPUTY', 'CLERK', 'ADMIN'] as const) {
      // Match "(ROLE)" so "CLERK" doesn't also match "Chambers Clerk (CHAMBERS_STAFF)".
      const option = roleSelect.locator('option', { hasText: `(${role})` });
      const value = await option.getAttribute('value');
      if (!value) continue;
      await roleSelect.selectOption(value);
      const addBtn = page.getByTestId('add-exhibit-button');
      await expect(addBtn, `Add exhibit must be visible for ${role}`).toBeVisible();
      // Still the documented disabled-placeholder (scope boundary unchanged).
      await expect(addBtn).toBeDisabled();
      sawAtLeastOne = true;
    }
    expect(sawAtLeastOne, 'at least one write-role option should exist in the seed').toBe(true);
  });
});
