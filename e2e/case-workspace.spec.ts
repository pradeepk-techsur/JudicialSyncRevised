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
    // Witness is now a searchable Carbon ComboBox (09-07), not a free-text input.
    // Type into its text field to narrow the open listbox, then pick the option.
    const witness = page.locator('#exhibit-witness-filter');
    await witness.click();
    await witness.fill('Finch');
    await page.getByRole('option', { name: /Finch/ }).click();
    await expect(page.getByText('P-3')).toBeVisible();
    await expect(page.getByText('P-1')).not.toBeVisible();

    // AND with a non-matching status narrows to zero. Status Dropdown now carries
    // a VISIBLE "Status" label (aria-label removed in 09-07); address it by id.
    await page.locator('#exhibit-status-filter').click();
    await page.getByRole('option', { name: 'MARKED' }).click();
    await expect(page.getByText('No exhibits match these filters.')).toBeVisible();

    await page.getByRole('button', { name: 'Clear filters' }).click();
    await expect(page.getByText('P-1')).toBeVisible();
    await expect(page.getByText('P-3')).toBeVisible();
  });

  // 09-07: the former static "Enter at least one filter…" hint is replaced by a
  // live "Showing X of Y" readout that is ALWAYS present (and the full list still
  // renders when no filter is active — never a hard error).
  test('empty search bar shows a live result-count readout, never a hard error', async ({
    page,
  }) => {
    await page.goto('/case');
    const readout = page.getByTestId('result-count');
    await expect(readout).toBeVisible();
    await expect(readout).toHaveText(/Showing \d+ of \d+/);
    // The old hint sentence is gone entirely.
    await expect(page.getByText(/Enter at least one filter/i)).toHaveCount(0);
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
  // colored text, rendered ONLY for ADMITTED rows. P-4 is the stable,
  // always-ADMITTED, always-present clean exhibit (plan 07-02 seed); the demo
  // seed computes no JuryPackage, so P-4 (admitted, unsealed, no member row)
  // reads the Phase-9 "Not yet evaluated" value — the corrected replacement for
  // Phase 8's incorrect always-"Not eligible". We assert the column renders a
  // recognized plain-language value carried verbatim from the server. (P-4 is
  // chosen over the legacy-admit P-6 for independence from the concurrent
  // re-seeding of those fixtures by sibling suites.)
  test('Jury Package column renders server-computed plain-language text for an admitted row', async ({
    page,
  }) => {
    await page.goto('/case');
    const row = page.locator('[data-testid="exhibit-row"][data-exhibit-label="P-4"]');
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

  // 09-19 gap closure (09-UAT.md test 6, severity major): fixes a CSS
  // specificity regression from 09-06 where Carbon's own
  // `.cds--data-table th:last-of-type { inline-size: auto }` silently
  // overrode `.colChevron`'s fixed width, splitting the remaining table
  // width ~50/50 between Description and the chevron column instead of
  // letting Description absorb it all — and where the Flags column's old
  // 10rem was narrower than the widest real SeverityPill label ever
  // rendered there ("Ex parte · restricted", ~165px), causing that pill to
  // visually overflow into the adjacent Jury Package cell.
  test('exhibit table rows render with zero cell-to-cell visual overlap at 1440px, including a row with multiple stacked Flags pills (UAT-6 gap closure)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/case');
    await page.waitForSelector('[data-testid="exhibit-row"]');

    // Every row's Flags cell and Jury Package cell must not visually
    // overlap — this is the exact failure mode reported ("rows are
    // broken"): a wide SeverityPill (e.g. "Ex parte · restricted")
    // spilling past its own column's right edge into the next cell's text.
    const rows = page.locator('[data-testid="exhibit-row"]');
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThan(0);
    let sawAPill = false;
    for (let i = 0; i < rowCount; i++) {
      const row = rows.nth(i);
      const cells = row.locator('td');
      const flagsCell = cells.nth(5); // Label, Description, Party, Status, Custodian, Flags, Jury, chevron
      const juryCell = cells.nth(6);
      // Locate the widest-pill case by its own tone/content rather than a
      // hardcoded exhibit label, so the test is robust to seed-data drift
      // (the sealed/ex-parte row always renders a critical-tone pill here).
      const pills = flagsCell.locator('[data-testid="severity-pill"]');
      const pillCount = await pills.count();
      for (let p = 0; p < pillCount; p++) {
        sawAPill = true;
        const pillBox = await pills.nth(p).boundingBox();
        const juryBox = await juryCell.boundingBox();
        expect(pillBox).not.toBeNull();
        expect(juryBox).not.toBeNull();
        // The pill's right edge must not cross into the Jury Package cell's
        // left edge — zero horizontal overlap.
        expect(pillBox!.x + pillBox!.width).toBeLessThanOrEqual(juryBox!.x + 1);
      }
    }
    // Guard against a vacuously-passing test: the seeded case must actually
    // exercise at least one Flags pill (S-1's "Ex parte · restricted" and
    // P-1's "Ruling pending"/"Open objection" are seeded by default).
    expect(sawAPill).toBe(true);

    // The Description column must be meaningfully wider than the
    // fixed-width Label column (the 09-06 defect collapsed it to the SAME
    // width as Label, ~96px, instead of absorbing the table's true
    // remainder).
    const firstRow = rows.first();
    const labelCellWidth = (await firstRow.locator('td').nth(0).boundingBox())!.width;
    const descCellWidth = (await firstRow.locator('td').nth(1).boundingBox())!.width;
    expect(descCellWidth).toBeGreaterThan(labelCellWidth * 1.5);

    // 09-21 gap-closure (UAT-6 RE-TEST): the 09-19 fix's own column-width
    // selector was a dead descendant-combinator (`.table :global(...)`) that
    // never matched Carbon's actual single-element DOM, so it silently did
    // nothing — Carbon's own `.cds--data-table th:last-of-type { inline-size:
    // auto }` kept splitting the remaining width ~50/50 between the chevron
    // column and Description instead of giving it all to Description. These
    // two assertions pin the ACTUAL mechanism (not just a downstream
    // consequence), so a future regression of this exact selector mistake
    // fails immediately instead of silently passing the overlap check above.
    const chevronHeaderWidth = (
      await page.locator('table thead th').last().boundingBox()
    )!.width;
    expect(chevronHeaderWidth).toBeLessThanOrEqual(33); // 2rem (32px) + 1px tolerance
    expect(descCellWidth).toBeGreaterThan(200); // the real ~272px remainder, not a ~152px 50/50 split
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

  // ---- Phase 9 (09-07, T-07) search-filter labeling + witness select + readout ----
  test.describe('T-07 search filter labels, witness select, result-count readout', () => {
    // Every filter control carries a VISIBLE text label (not merely an
    // accessible name on a visually-hidden <label>). Assert each label is a
    // visible text node within the filter bar — getByLabel alone would pass even
    // for a hideLabel'd control, so we assert visibility of the text itself.
    test('every filter shows a visible text label (Search, Status, Witness, From, To)', async ({
      page,
    }) => {
      await page.goto('/case');
      const bar = page.getByTestId('search-filter-bar');
      await expect(bar).toBeVisible();
      for (const label of ['Search', 'Status', 'Witness', 'From', 'To']) {
        await expect(
          bar.getByText(label, { exact: true }),
          `"${label}" label must be a visible text node`,
        ).toBeVisible();
      }
    });

    // The Witness control is a real combobox (Carbon ComboBox → role="combobox"
    // inside a .cds--list-box) that opens a dropdown of real seeded witness names
    // when clicked/typed into — not a free-text input.
    test('Witness is a combobox that opens real seeded witness names', async ({ page }) => {
      await page.goto('/case');
      const witness = page.locator('#exhibit-witness-filter');
      await expect(witness).toHaveAttribute('role', 'combobox');
      // The control lives inside Carbon's list-box wrapper.
      await expect(
        page.locator('.cds--list-box').filter({ has: witness }).first(),
      ).toBeVisible();
      // Opening it reveals seeded witness names (P-3 → "Dr. Amara Finch", P-1 →
      // "Det. Raymond Cole") — real values derived from the loaded list, never
      // free text.
      await witness.click();
      await expect(page.getByRole('option', { name: 'Dr. Amara Finch' })).toBeVisible();
      await expect(page.getByRole('option', { name: 'Det. Raymond Cole' })).toBeVisible();
    });

    // After applying any filter, the page shows "Showing N of M" with N <= M.
    test('applying a filter shows "Showing N of M" with N <= M', async ({ page }) => {
      await page.goto('/case');
      const readout = page.getByTestId('result-count');
      await expect(readout).toBeVisible();
      // Wait for the list to load before reading the total — the initial render
      // shows "Showing 0 of 0" until the query resolves. P-1 visible ⇒ loaded.
      await expect(page.getByText('P-1')).toBeVisible();
      await expect(readout).not.toHaveText('Showing 0 of 0');

      // Capture the unfiltered total.
      const fullText = (await readout.textContent()) ?? '';
      const fullMatch = fullText.match(/Showing (\d+) of (\d+)/);
      expect(fullMatch, 'readout must read "Showing N of M"').not.toBeNull();
      const total = Number(fullMatch![2]);
      expect(total).toBeGreaterThan(0);

      // Narrow with the witness select.
      const witness = page.locator('#exhibit-witness-filter');
      await witness.click();
      await page.getByRole('option', { name: 'Dr. Amara Finch' }).click();

      await expect(readout).toHaveText(/Showing \d+ of \d+/);
      const narrowedText = (await readout.textContent()) ?? '';
      const nm = narrowedText.match(/Showing (\d+) of (\d+)/)!;
      const visible = Number(nm[1]);
      const totalWhileFiltered = Number(nm[2]);
      expect(visible).toBeLessThanOrEqual(totalWhileFiltered);
      // The total stays the full unfiltered count; the visible count shrinks.
      expect(totalWhileFiltered).toBe(total);
      expect(visible).toBeLessThan(total);
    });

    // Clicking "Clear filters" resets to the full unfiltered list and the readout
    // updates accordingly.
    test('Clear filters resets to the full list and updates the readout', async ({ page }) => {
      await page.goto('/case');
      const readout = page.getByTestId('result-count');
      // Wait for the list to load before reading the total.
      await expect(page.getByText('P-1')).toBeVisible();
      await expect(readout).not.toHaveText('Showing 0 of 0');
      const fullText = (await readout.textContent()) ?? '';
      const total = Number(fullText.match(/Showing (\d+) of (\d+)/)![2]);

      // Apply a filter → Clear filters appears.
      const witness = page.locator('#exhibit-witness-filter');
      await witness.click();
      await page.getByRole('option', { name: 'Dr. Amara Finch' }).click();
      const clear = page.getByTestId('clear-filters-readout');
      await expect(clear).toBeVisible();

      await clear.click();

      // Readout returns to the full count (N === M === total), Clear filters hides.
      await expect(readout).toHaveText(`Showing ${total} of ${total}`);
      await expect(page.getByTestId('clear-filters-readout')).toHaveCount(0);
      await expect(page.getByText('P-1')).toBeVisible();
      await expect(page.getByText('P-3')).toBeVisible();
    });
  });
});
