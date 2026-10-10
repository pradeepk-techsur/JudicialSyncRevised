import {
  test,
  expect,
  type Page,
  type APIRequestContext,
} from '@playwright/test';
import { contrastRatio } from '../src/lib/contrastRatio';

// T-12 (09-14) accessibility audit: a locally-computed WCAG contrast-ratio sweep
// across the four main pages (Command Center, Case Workspace, Exhibit Detail,
// Jury Package), proving every rendered text node meets AA (>= 4.5:1) against its
// effective background. ZERO new dependency — this phase's constraint is "no npm
// dependency beyond next/font" (09-CONTEXT.md), so this spec does NOT add
// @axe-core/playwright. It reuses the SAME dependency-free WCAG relative-
// luminance + contrast-ratio arithmetic 09-02 first wrote inline in
// SeverityPill.test.ts, now lifted into the shared src/lib/contrastRatio.ts so
// test and stylesheet guard can never drift.
//
// The actual pixel colors are read from the LIVE rendered DOM via
// getComputedStyle (foreground color + the nearest non-transparent ancestor
// background), so this audits the FINAL state of every screen this phase touched
// — exactly why T-12 intentionally runs last among the structural tickets.
//
// WCAG AA allows 3:1 for "large text" (>= 24px, or >= 18.66px bold). We enforce
// the stricter 4.5:1 on EVERY text node regardless of size, which is the ticket's
// own verbatim threshold ("timestamps, helper text, and sub-labels meet 4.5:1")
// and a superset-safe assertion — large text that clears 4.5 also clears 3.

const MIN_CONTRAST = 4.5;

async function getCaseId(request: APIRequestContext): Promise<string> {
  const res = await request.get('/api/case');
  const { case: kase } = await res.json();
  return kase.id;
}

async function getAnExhibitId(request: APIRequestContext): Promise<string> {
  const caseId = await getCaseId(request);
  const res = await request.get(`/api/cases/${caseId}/exhibits`, {
    headers: { 'X-User-Role': 'JUDGE' },
  });
  const rows = await res.json();
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('No seeded exhibits found to resolve an /exhibit/:id route');
  }
  return rows[0].exhibitId;
}

type Offender = {
  selector: string;
  text: string;
  color: string;
  background: string;
  ratio: number;
};

// Collect, from the LIVE page, every visible text-bearing element paired with its
// rendered foreground color and effective (nearest non-transparent) background.
// The contrast math is done Node-side with the shared contrastRatio() so there is
// exactly one formula in the codebase; this evaluate() only extracts raw colors.
async function collectTextColorPairs(page: Page): Promise<
  Array<{ selector: string; text: string; color: string; background: string }>
> {
  return page.evaluate(() => {
    // Resolve the EFFECTIVE (fully-opaque, as-painted) background by compositing
    // every ancestor background over the one beneath it using the standard
    // source-over alpha blend. A translucent overlay (e.g. the sidebar active
    // item's rgba(255,255,255,0.08) wash over dark navy) must be blended with its
    // parent, NOT treated as if it were opaque white — otherwise white nav text
    // on navy would be wrongly scored as white-on-near-white. The viewport
    // default beneath everything is opaque white.
    function parseRgba(s: string): [number, number, number, number] | null {
      const m = s.match(/rgba?\(([^)]+)\)/i);
      if (!m) return null;
      const p = m[1].split(',').map((x) => parseFloat(x.trim()));
      return [p[0], p[1], p[2], p.length >= 4 ? p[3] : 1];
    }

    function effectiveBackground(start: Element): string {
      // Collect the background layers from the element outward to <html>.
      const layers: [number, number, number, number][] = [];
      let el: Element | null = start;
      while (el) {
        const parsed = parseRgba(getComputedStyle(el).backgroundColor);
        if (parsed && parsed[3] > 0) layers.push(parsed);
        el = el.parentElement;
      }
      // Base layer = opaque white, then composite from the farthest ancestor
      // (end of list) toward the element (start of list): source-over.
      let [r, g, b] = [255, 255, 255];
      for (let i = layers.length - 1; i >= 0; i--) {
        const [sr, sg, sb, sa] = layers[i];
        r = Math.round(sr * sa + r * (1 - sa));
        g = Math.round(sg * sa + g * (1 - sa));
        b = Math.round(sb * sa + b * (1 - sa));
      }
      return `rgb(${r}, ${g}, ${b})`;
    }

    // A short, stable-ish selector for diagnostics (tag + testid/first class).
    function describe(el: Element): string {
      const tid = el.getAttribute('data-testid');
      if (tid) return `${el.tagName.toLowerCase()}[data-testid="${tid}"]`;
      const cls = (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean)[0];
      return cls ? `${el.tagName.toLowerCase()}.${cls}` : el.tagName.toLowerCase();
    }

    const results: {
      selector: string;
      text: string;
      color: string;
      background: string;
    }[] = [];

    const all = Array.from(document.querySelectorAll('body *'));
    for (const el of all) {
      // Only elements that DIRECTLY own visible text (a non-empty text node that
      // is their own immediate child) — this attributes the color to the element
      // that actually paints the glyphs, not a wrapping container.
      const ownText = Array.from(el.childNodes)
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => n.textContent ?? '')
        .join('')
        .trim();
      if (!ownText) continue;

      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      if (parseFloat(cs.opacity) === 0) continue;

      // Skip controls in the DISABLED state — WCAG 1.4.3 explicitly exempts
      // inactive/disabled UI components from the contrast minimum (e.g. Carbon's
      // Send button is disabled, and greyed, while the assistant input is empty).
      if (
        (el as HTMLButtonElement).disabled ||
        el.getAttribute('aria-disabled') === 'true' ||
        el.closest('[disabled], [aria-disabled="true"]')
      ) {
        continue;
      }

      const rect = (el as HTMLElement).getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;

      // Skip visually-hidden (screen-reader-only / clipped) utility text — it is
      // not painted for sighted users, so its contrast is irrelevant.
      if (
        cs.clip === 'rect(0px, 0px, 0px, 0px)' ||
        (rect.width <= 1 && rect.height <= 1)
      ) {
        continue;
      }

      results.push({
        selector: describe(el),
        text: ownText.slice(0, 40),
        color: cs.color,
        background: effectiveBackground(el),
      });
    }
    return results;
  });
}

async function auditPage(page: Page): Promise<Offender[]> {
  const pairs = await collectTextColorPairs(page);
  // Sanity: the page must actually have rendered text to audit — a blank page
  // trivially "passing" would be a false green.
  expect(pairs.length, 'page rendered at least some text to audit').toBeGreaterThan(
    0,
  );

  const offenders: Offender[] = [];
  for (const p of pairs) {
    let ratio: number;
    try {
      ratio = contrastRatio(p.color, p.background);
    } catch {
      // Unparseable color (e.g. a gradient / currentColor edge) — skip rather
      // than fail; the audit targets concrete fg/bg color pairs.
      continue;
    }
    if (ratio < MIN_CONTRAST) {
      offenders.push({ ...p, ratio: Math.round(ratio * 100) / 100 });
    }
  }
  return offenders;
}

function formatOffenders(pageName: string, offenders: Offender[]): string {
  return (
    `${pageName}: ${offenders.length} text element(s) below ${MIN_CONTRAST}:1 AA contrast:\n` +
    offenders
      .map(
        (o) =>
          `  - ${o.selector} "${o.text}" — ${o.color} on ${o.background} = ${o.ratio}:1`,
      )
      .join('\n')
  );
}

test.describe('T-12 accessibility audit: >=4.5:1 AA contrast on the 4 main pages', () => {
  test('Command Center text all meets 4.5:1 AA contrast', async ({ page }) => {
    await page.goto('/command-center');
    await expect(
      page.getByRole('heading', { name: /recent activity/i }),
    ).toBeVisible();
    const offenders = await auditPage(page);
    expect(offenders.length, formatOffenders('Command Center', offenders)).toBe(0);
  });

  test('Case Workspace text all meets 4.5:1 AA contrast', async ({ page }) => {
    await page.goto('/case');
    // The case workspace renders the exhibit table once the list query resolves.
    await expect(page.getByRole('table')).toBeVisible();
    const offenders = await auditPage(page);
    expect(offenders.length, formatOffenders('Case Workspace', offenders)).toBe(0);
  });

  test('Exhibit Detail text all meets 4.5:1 AA contrast', async ({
    page,
    request,
  }) => {
    const exhibitId = await getAnExhibitId(request);
    await page.goto(`/exhibit/${exhibitId}`);
    // Timeline list is the primary content; wait for it to settle.
    await expect(page.getByRole('heading').first()).toBeVisible();
    const offenders = await auditPage(page);
    expect(offenders.length, formatOffenders('Exhibit Detail', offenders)).toBe(0);
  });

  test('Jury Package text all meets 4.5:1 AA contrast', async ({ page }) => {
    await page.goto('/jury-package');
    await expect(page.getByRole('heading').first()).toBeVisible();
    const offenders = await auditPage(page);
    expect(offenders.length, formatOffenders('Jury Package', offenders)).toBe(0);
  });
});
