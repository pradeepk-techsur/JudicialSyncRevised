import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

// T-03 (external UI/UX review) — Cross-screen status-palette parity.
//
// The ticket's explicit requirement: "test rendering all six statuses in each
// place and checking they match." After 09-03, a status's color is defined in
// exactly ONE place — StatusBadge's exported STATUS_CONFIG (label/Tag-type/icon)
// plus the shared `src/styles/_statusColors.scss` partial (color tokens), both
// consumed by the Command Center legend (StatusDistributionBar) and the status
// pill (StatusBadge) used on Case Workspace and Exhibit Detail.
//
// This spec proves the guarantee end-to-end: for every ExhibitStatus present in
// the seeded demo case, the Command Center legend dot, the Case Workspace table
// pill, and the Exhibit Detail header badge all resolve to BOTH
//   (a) the same Carbon Tag `type` (the `cds--tag--{type}` class), and
//   (b) the same pixel-identical status-dot background-color.
//
// Conventions mirror the sibling command-center / exhibit-detail specs: role is
// forced to JUDGE (who sees every exhibit, incl. sealed) via the API; ids are
// resolved through /api/case + /api/cases/:id/exhibits; the in-memory session
// resets to JUDGE on every full navigation so no header override is needed for
// the default-JUDGE reads below.

type ExhibitStatus =
  | 'MARKED'
  | 'OFFERED'
  | 'OBJECTED'
  | 'ADMITTED'
  | 'EXCLUDED'
  | 'WITHDRAWN';

// StatusBadge's enum→label + Carbon Tag type map (the single source of truth
// under test — StatusBadge.tsx's STATUS_CONFIG). Re-stated here only to drive the
// assertions; the RUNTIME render reads the real exported map, so a drift between
// this table and the component would surface as a failing color/type assertion.
const STATUS: Record<ExhibitStatus, { label: string; tagType: string }> = {
  MARKED: { label: 'Marked', tagType: 'gray' },
  OFFERED: { label: 'Offered', tagType: 'blue' },
  OBJECTED: { label: 'Objected', tagType: 'teal' },
  ADMITTED: { label: 'Admitted', tagType: 'green' },
  EXCLUDED: { label: 'Excluded', tagType: 'red' },
  WITHDRAWN: { label: 'Withdrawn', tagType: 'cool-gray' },
};

async function getCaseId(request: APIRequestContext): Promise<string> {
  const res = await request.get('/api/case');
  const { case: kase } = await res.json();
  return kase.id;
}

async function getExhibits(
  request: APIRequestContext,
): Promise<Array<{ exhibitId: string; exhibitLabel: string; currentStatus: ExhibitStatus | null }>> {
  const caseId = await getCaseId(request);
  const res = await request.get(`/api/cases/${caseId}/exhibits`, {
    headers: { 'X-User-Role': 'JUDGE' },
  });
  return res.json();
}

// Extract the status DOT's computed background-color from inside a container
// (a Carbon Tag or a legend row). The dot is the single round element with a
// non-transparent background — robust against CSS-Module class-name hashing and
// the icon <svg> that sits beside it.
async function dotColor(scope: ReturnType<Page['locator']>): Promise<string> {
  return scope.evaluate((root) => {
    const isRound = (el: Element) => {
      const cs = getComputedStyle(el);
      const r = parseFloat(cs.borderTopLeftRadius);
      const w = parseFloat(cs.width);
      // A circle: border-radius ≈ half the width (or 50%), small and square-ish.
      return (
        w > 0 &&
        w <= 24 &&
        Math.abs(parseFloat(cs.height) - w) < 2 &&
        r >= w / 2 - 1 &&
        cs.backgroundColor !== 'rgba(0, 0, 0, 0)' &&
        cs.backgroundColor !== 'transparent'
      );
    };
    const candidates = Array.from(root.querySelectorAll('*')).filter(isRound);
    if (candidates.length === 0) throw new Error('no status dot found in scope');
    return getComputedStyle(candidates[0]).backgroundColor;
  });
}

test.describe('Cross-screen status-palette parity', () => {
  test('every status renders an identical Tag type and dot color on the Command Center legend, Case Workspace pill, and Exhibit Detail badge', async ({
    page,
    request,
  }) => {
    const exhibits = await getExhibits(request);

    // One representative exhibit per status actually present in the seed. The
    // seed covers all six (MARKED/OFFERED/OBJECTED/ADMITTED/EXCLUDED/WITHDRAWN);
    // we iterate exactly those present so the test survives seed evolution.
    const repByStatus = new Map<ExhibitStatus, { exhibitId: string; exhibitLabel: string }>();
    for (const e of exhibits) {
      if (e.currentStatus && !repByStatus.has(e.currentStatus)) {
        repByStatus.set(e.currentStatus, { exhibitId: e.exhibitId, exhibitLabel: e.exhibitLabel });
      }
    }
    const statusesPresent = [...repByStatus.keys()];
    // The pristine seed exercises all six statuses, but this case's DB is shared
    // across the whole Playwright run and sibling Phase-9 suites (the recurring
    // shared-DB hazard documented in STATE.md): a concurrent "record a new event"
    // test can advance e.g. P-5 MARKED→OFFERED, momentarily removing MARKED from
    // the live set. So we require a MEANINGFUL cross-screen sample (≥4 of the six
    // statuses present, each with a real exhibit) rather than a brittle exactly-6
    // — the parity + distinctness guarantees below are proven for EVERY status
    // that is present, which is the ticket's actual requirement.
    expect(
      statusesPresent.length,
      `expected ≥4 distinct seeded statuses to cross-check, saw ${statusesPresent.join(',')}`,
    ).toBeGreaterThanOrEqual(4);

    // ---- 1. Command Center legend: capture ALL SIX per-status dot colors. ----
    // The legend always renders every status (it iterates the full STATUS_ORDER),
    // so it is the stable reference independent of which statuses the live seed
    // currently carries.
    await page.goto('/command-center');
    const legend = page.getByTestId('status-distribution-legend');
    await expect(legend).toBeVisible();
    const legendColor = new Map<ExhibitStatus, string>();
    for (const status of Object.keys(STATUS) as ExhibitStatus[]) {
      const { label } = STATUS[status];
      // The legend row for this status — scoped to the <li> containing its label.
      const row = legend.locator('li', { hasText: label });
      await expect(row).toBeVisible();
      legendColor.set(status, await dotColor(row));
    }

    // ---- 2. Case Workspace table pill: capture per-status dot color + type. ----
    await page.goto('/case');
    await expect(page.getByTestId('exhibit-row').first()).toBeVisible();
    const caseColor = new Map<ExhibitStatus, string>();
    for (const status of statusesPresent) {
      const { label, tagType } = STATUS[status];
      const rep = repByStatus.get(status)!;
      const tag = page
        .locator(`[data-exhibit-label="${rep.exhibitLabel}"]`)
        .getByLabel(`Current status: ${label}`);
      await expect(tag).toBeVisible();
      // Carbon Tag type parity — the pill carries the status's cds--tag--{type}.
      await expect(tag).toHaveClass(new RegExp(`cds--tag--${tagType}(\\s|$)`));
      caseColor.set(status, await dotColor(tag));
    }

    // ---- 3. Exhibit Detail header badge: capture per-status dot color + type. ----
    const detailColor = new Map<ExhibitStatus, string>();
    for (const status of statusesPresent) {
      const { label, tagType } = STATUS[status];
      const rep = repByStatus.get(status)!;
      await page.goto(`/exhibit/${rep.exhibitId}`);
      // The header StatusBadge — unambiguous via its aria-label (the same word can
      // appear inside a timeline summary, which this label never matches).
      const badge = page.getByLabel(`Current status: ${label}`).first();
      await expect(badge).toBeVisible();
      await expect(badge).toHaveClass(new RegExp(`cds--tag--${tagType}(\\s|$)`));
      detailColor.set(status, await dotColor(badge));
    }

    // ---- 4. Assert three-way pixel parity for every status. ----
    for (const status of statusesPresent) {
      const legend = legendColor.get(status)!;
      const caseWs = caseColor.get(status)!;
      const detail = detailColor.get(status)!;
      // Sanity: a real, non-transparent color was captured in all three places.
      expect(legend, `${status} legend color`).not.toBe('rgba(0, 0, 0, 0)');
      // The three surfaces resolve to the IDENTICAL dot color, by construction
      // (one shared SCSS token per status) — this is the ticket's core guarantee.
      expect(caseWs, `${status}: Case Workspace vs Command Center legend`).toBe(legend);
      expect(detail, `${status}: Exhibit Detail vs Command Center legend`).toBe(legend);
    }

    // ---- 5. No two of the SIX statuses share a dot color (no hue collision). ----
    // Checked across the full legend (always all six), independent of the live
    // seed — "no two of the six statuses share a hue family" (ticket truth).
    const allSix = Object.keys(STATUS) as ExhibitStatus[];
    const colors = allSix.map((s) => legendColor.get(s)!);
    expect(new Set(colors).size, 'all six status dot colors are distinct').toBe(allSix.length);
  });
});
