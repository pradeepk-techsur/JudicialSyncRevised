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

  test('the current route\'s nav item is marked active and updates on navigation (09-08 T-08)', async ({ page }) => {
    // 09-08 gives the sidebar route-driven active feedback via Carbon's
    // `isActive` prop (adds `.cds--side-nav__link--current`), replacing the
    // weak default link styling. Assert the active item tracks the route.
    await page.goto('/case');
    const nav = page.getByRole('navigation', { name: 'Main navigation' });

    const caseLink = nav.getByRole('link', { name: 'Case Workspace' });
    const commandLink = nav.getByRole('link', { name: 'Command Center' });

    // On /case, Case Workspace is the current (active) item; Command Center is not.
    await expect(caseLink).toHaveClass(/cds--side-nav__link--current/);
    await expect(commandLink).not.toHaveClass(/cds--side-nav__link--current/);

    // Navigating to Command Center flips which item is marked active.
    await commandLink.click();
    await expect(page).toHaveURL(/\/command-center$/);
    await expect(commandLink).toHaveClass(/cds--side-nav__link--current/);
    await expect(caseLink).not.toHaveClass(/cds--side-nav__link--current/);
  });

  test('every sidebar nav item renders a leading icon (09-08 T-08)', async ({ page }) => {
    // Each SideNavLink now gets a Carbon `renderIcon` — the link contains an
    // <svg> glyph before its text label.
    await page.goto('/case');
    const nav = page.getByRole('navigation', { name: 'Main navigation' });
    for (const name of ['Command Center', 'Case Workspace', 'Assistant']) {
      await expect(nav.getByRole('link', { name }).locator('svg').first()).toBeVisible();
    }
    // Jury Package link (its accessible name may include the count badge text).
    await expect(
      nav.getByRole('link', { name: /Jury Package/ }).locator('svg').first(),
    ).toBeVisible();
  });

  test('Jury Package badge counts jury-package blockers (FLAGGED or sealed), matching the page (09-08 T-08)', async ({ page }) => {
    // 09-08 changed the Jury Package nav badge from the case-wide open-discrepancy
    // count (useDiscrepancyCount) to the jury-package blocker count (useJuryPackage,
    // the SAME FLAGGED-or-sealed formula the Jury Package page's "Blockers (N)"
    // heading and the Command Center stat card use). Mock the jury-package endpoint
    // with 2 FLAGGED blocker rows + 1 clean row → the sidebar badge must read "2".
    const blockers = {
      juryPackage: {
        id: 'pkg-badge', caseId: 'case-1', status: 'DRAFT',
        createdAt: new Date().toISOString(), finalizedAt: null, finalizedBy: null,
        finalizationRequestedAt: null, finalizationRequestedBy: null,
      },
      exhibits: [
        { exhibitId: 'ex-1', exhibitLabel: 'P-7', currentStatus: 'ADMITTED', discrepancyStatus: 'FLAGGED', flags: [{ ruleCode: 'UNRESOLVED_OBJECTION_JURY_ELIGIBLE', status: 'OPEN', label: 'x' }], isSealed: false, status: 'INCLUDED', addedAt: new Date().toISOString() },
        { exhibitId: 'ex-2', exhibitLabel: 'P-6', currentStatus: 'ADMITTED', discrepancyStatus: 'FLAGGED', flags: [{ ruleCode: 'ADMITTED_NO_CUSTODIAN', status: 'OPEN', label: 'y' }], isSealed: false, status: 'INCLUDED', addedAt: new Date().toISOString() },
        { exhibitId: 'ex-3', exhibitLabel: 'P-4', currentStatus: 'ADMITTED', discrepancyStatus: 'CLEAN', flags: [], isSealed: false, status: 'INCLUDED', addedAt: new Date().toISOString() },
      ],
    };
    await page.route('**/api/cases/**/jury-package', async (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(blockers) });
    });

    await page.goto('/case');
    const badge = page.getByTestId('jury-count-badge');
    // Badge shows the blocker count (2), NOT a case-wide discrepancy count, and
    // carries the new jury-package-blockers semantics in its aria-label.
    await expect(badge).toHaveText('2');
    await expect(badge).toHaveAttribute('aria-label', '2 jury package blockers');
  });

  test('switching roles shows a persistent active-role banner, flips a role-gated control WITHOUT reload, and Switch back restores both (09-09 T-09)', async ({ page }) => {
    // T-09: proves the three acceptance behaviors in one mid-session flow:
    //   1. after a role switch, a persistent banner names the new active role;
    //   2. a role-gated control's visibility flips immediately on switch with NO
    //      page.reload() — because every live-sync query key includes `role`,
    //      the switch re-queries as the new role within one poll interval;
    //   3. "Switch back" restores the prior role AND its gated-control visibility.
    //
    // The gated control used is the Command Center attention feed's
    // JUDGE-only "Record ruling" action (RULING_ROLES=['JUDGE']). The feed is
    // mocked with one HIGH entry so the action is deterministically present for
    // JUDGE regardless of seed drift.
    await page.route('**/api/cases/**/attention-feed', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'high-1',
            tier: 'HIGH',
            ruleCode: 'UNRESOLVED_OBJECTION_JURY_ELIGIBLE',
            exhibitId: 'ex-high',
            exhibitLabel: 'P-7',
            objectionId: 'obj-high',
            detectedAt: new Date().toISOString(),
            summary: 'P-7 — admitted with an open, unresolved objection',
            availableAction: 'RECORD_RULING',
          },
        ]),
      });
    });

    await page.goto('/command-center');

    const feed = page.getByTestId('attention-feed');
    await expect(feed).toBeVisible();

    // Default JUDGE: the Record-ruling action is present; no banner yet (no
    // switch has happened, so there's nothing to switch back to).
    await expect(feed.getByTestId('attention-feed-action-record-ruling').first()).toBeVisible();
    await expect(page.getByTestId('active-role-banner')).toHaveCount(0);

    // Switch to a DEPUTY persona via the shared switcher (NO page.reload()).
    const select = page.getByLabel('Switch active role');
    const deputyOption = select.locator('option', { hasText: '(DEPUTY)' });
    const deputyValue = (await deputyOption.getAttribute('value')) as string;
    await select.selectOption(deputyValue);

    // 1. The persistent banner now names the active DEPUTY role.
    const banner = page.getByTestId('active-role-banner');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText(/Active role:/);
    await expect(banner).toContainText(/DEPUTY/);

    // 2. The JUDGE-gated control is now ABSENT — the switch re-queried as DEPUTY
    //    with no reload (role participates in the query key).
    await expect(feed.getByTestId('attention-feed-action-record-ruling')).toHaveCount(0);

    // 3. Switch back restores the prior JUDGE role and its gated control.
    await banner.getByTestId('active-role-switch-back').click();
    await expect(feed.getByTestId('attention-feed-action-record-ruling').first()).toBeVisible();
    // The banner persists after switching back, now naming JUDGE as active with
    // DEPUTY as the switch-back target.
    await expect(banner).toContainText(/JUDGE/);
  });

  test('the active-role banner text is NOT obscured by the sidebar after a role switch (UAT-9 gap closure)', async ({ page }) => {
    await page.goto('/case');
    const select = page.getByLabel('Switch active role');
    const deputyOption = select.locator('option', { hasText: '(DEPUTY)' });
    const deputyValue = (await deputyOption.getAttribute('value')) as string;
    await select.selectOption(deputyValue);

    const banner = page.getByTestId('active-role-banner');
    await expect(banner).toBeVisible();

    const nav = page.getByRole('navigation', { name: 'Main navigation' });
    const navBox = await nav.boundingBox();
    const labelBox = await banner.locator('span').first().boundingBox();
    expect(navBox).not.toBeNull();
    expect(labelBox).not.toBeNull();
    // The banner's own label text must start AT OR AFTER the sidebar's right
    // edge — zero horizontal overlap between the two.
    expect(labelBox!.x).toBeGreaterThanOrEqual(navBox!.x + navBox!.width - 1);

    // Stronger check: hit-test the actual rendered center of the banner's
    // label text and confirm the SIDEBAR isn't the topmost element there
    // (mirrors the existing sidebar/header overlap test's hit-test pattern).
    const centerX = labelBox!.x + labelBox!.width / 2;
    const centerY = labelBox!.y + labelBox!.height / 2;
    const topElementTag = await page.evaluate(
      ({ x, y }) => document.elementFromPoint(x, y)?.closest('nav') ? 'nav' : document.elementFromPoint(x, y)?.tagName ?? null,
      { x: centerX, y: centerY },
    );
    expect(topElementTag).not.toBe('nav');
  });

  test('the role switcher has no visible "Demo role" label and left-aligns with the page title (UAT-16 gap closure)', async ({ page }) => {
    await page.goto('/command-center');
    // The visible label text is gone — Carbon's hideLabel applies its
    // cds--visually-hidden class, so the label element exists in the DOM
    // (preserving the aria/htmlFor association) but is not visually rendered.
    const label = page.locator('label[for="role-switcher"]');
    await expect(label).toHaveClass(/cds--visually-hidden/);

    // The accessible name is unchanged — every existing getByLabel locator
    // across the suite continues to resolve.
    const select = page.getByLabel('Switch active role');
    await expect(select).toBeVisible();

    // Left-edge alignment with the page title.
    const title = page.locator('h1', { hasText: 'Trial Command Center' });
    const titleBox = await title.boundingBox();
    const selectBox = await select.boundingBox();
    expect(titleBox).not.toBeNull();
    expect(selectBox).not.toBeNull();
    expect(Math.abs(selectBox!.x - titleBox!.x)).toBeLessThanOrEqual(2);
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
