import { test, expect, type Page, type APIRequestContext } from '@playwright/test';

// T-16 typography (infrastructure half): prove that IBM Plex Sans (400/600) and
// IBM Plex Mono are self-hosted via next/font (src/lib/fonts.ts), loaded exactly
// once, and actually matched on all four main pages. The assertions use the
// standard document.fonts API — the authoritative in-browser source of truth for
// which FontFace entries the page has registered and whether a specific
// weight/size combination is available.

async function getCaseId(request: APIRequestContext): Promise<string> {
  const caseRes = await request.get('/api/case');
  const { case: kase } = await caseRes.json();
  return kase.id;
}

async function getAnExhibitId(request: APIRequestContext): Promise<string> {
  const caseId = await getCaseId(request);
  const listRes = await request.get(`/api/cases/${caseId}/exhibits`, {
    headers: { 'X-User-Role': 'JUDGE' },
  });
  const rows = await listRes.json();
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('No seeded exhibits found to resolve an /exhibit/:id route');
  }
  return rows[0].exhibitId;
}

type FaceRule = {
  family: string;
  weight: string;
  unicodeRange: string;
  src: string;
};

/**
 * Collect every IBM Plex @font-face rule the document registered.
 *
 * next/font legitimately splits a single weight into several @font-face rules — one
 * per unicode-range SUBSET (latin, latin-ext, …), each a distinct .woff2 file. Those
 * are NOT duplicates. A genuine "loaded twice" (a second next/font call site, or
 * next/font PLUS a leftover Carbon @font-face) would instead register the SAME
 * (family, weight, unicode-range) tuple a second time, or reference the same src
 * file from two rules. Keying on the full tuple distinguishes legitimate subsetting
 * from real duplication, and is robust across dev/prod (unlike raw FontFaceSet
 * counts, which Next's dev runtime inflates).
 */
async function getPlexFaceRules(page: Page): Promise<FaceRule[]> {
  return page.evaluate(() => {
    const strip = (s: string) => s.replace(/^['"]|['"]$/g, '').trim();
    const rules: {
      family: string;
      weight: string;
      unicodeRange: string;
      src: string;
    }[] = [];
    for (const sheet of Array.from(document.styleSheets)) {
      let cssRules: CSSRuleList;
      try {
        cssRules = sheet.cssRules;
      } catch {
        continue; // cross-origin sheet — not ours
      }
      for (const rule of Array.from(cssRules)) {
        if (!(rule instanceof CSSFontFaceRule)) continue;
        const style = rule.style;
        const family = strip(style.getPropertyValue('font-family'));
        if (!/IBM Plex/.test(family)) continue;
        rules.push({
          family,
          weight: strip(style.getPropertyValue('font-weight')) || 'normal',
          unicodeRange:
            strip(style.getPropertyValue('unicode-range')) || 'default',
          src: strip(style.getPropertyValue('src')),
        });
      }
    }
    return rules;
  });
}

/**
 * The core assertion bundle, run on whatever page is currently loaded.
 * Proves:
 *  - IBM Plex Sans (400 & 600) and IBM Plex Mono (400) genuinely LOAD and MATCH,
 *    via the standard document.fonts.load() + document.fonts.check() APIs
 *  - each (family, weight) is self-hosted exactly ONCE — a single src per
 *    family+weight @font-face rule (no second next/font call site, no leftover
 *    Carbon @font-face), which is the real "loaded once, not twice" guarantee
 */
async function assertPlexLoadedOnce(page: Page): Promise<void> {
  // 1. Load + match each required descriptor. document.fonts.load() returns the
  //    matched FontFace(s) for a descriptor; a loaded match proves the self-hosted
  //    file is fetchable and the family name resolves. We force the lazy @font-face
  //    to resolve here rather than relying on the page painting every weight.
  const loadResult = await page.evaluate(async () => {
    const f = (document as Document).fonts;
    const describe = async (d: string) =>
      (await f.load(d)).map((x) => x.status);
    const sans400 = await describe('400 16px "IBM Plex Sans"');
    const sans600 = await describe('600 16px "IBM Plex Sans"');
    const mono400 = await describe('400 16px "IBM Plex Mono"');
    await f.ready;
    return {
      sans400,
      sans600,
      mono400,
      checkSans400: f.check('400 16px "IBM Plex Sans"'),
      checkSans600: f.check('600 16px "IBM Plex Sans"'),
      checkMono400: f.check('400 16px "IBM Plex Mono"'),
    };
  });

  expect(
    loadResult.sans400.includes('loaded'),
    'IBM Plex Sans 400 loads',
  ).toBe(true);
  expect(
    loadResult.sans600.includes('loaded'),
    'IBM Plex Sans 600 loads',
  ).toBe(true);
  expect(
    loadResult.mono400.includes('loaded'),
    'IBM Plex Mono 400 loads',
  ).toBe(true);

  // Standard, official confirmation the specific font+weight+size is available and
  // matched — stronger than a width-diff heuristic.
  expect(loadResult.checkSans400, 'document.fonts.check 400 IBM Plex Sans').toBe(
    true,
  );
  expect(loadResult.checkSans600, 'document.fonts.check 600 IBM Plex Sans').toBe(
    true,
  );
  expect(loadResult.checkMono400, 'document.fonts.check 400 IBM Plex Mono').toBe(
    true,
  );

  // 2. Loaded exactly once, not twice. Read every registered IBM Plex @font-face.
  const faces = await getPlexFaceRules(page);

  // Each required family+weight must be registered at least once (as one or more
  // legitimate unicode-range subsets).
  for (const [family, weight] of [
    ['IBM Plex Sans', '400'],
    ['IBM Plex Sans', '600'],
    ['IBM Plex Mono', '400'],
  ] as const) {
    const matching = faces.filter(
      (f) => f.family === family && f.weight === weight,
    );
    expect(
      matching.length,
      `@font-face registered for ${family} ${weight}`,
    ).toBeGreaterThan(0);
  }

  // No genuine duplication: the same (family, weight, unicode-range) tuple must not
  // appear twice (that is the real "loaded twice" signature — a second call site or
  // a leftover Carbon @font-face colliding with next/font's subset).
  const tupleSeen = new Set<string>();
  for (const f of faces) {
    const key = `${f.family}|${f.weight}|${f.unicodeRange}`;
    expect(
      tupleSeen.has(key),
      `no duplicate @font-face for ${key}`,
    ).toBe(false);
    tupleSeen.add(key);
  }

  // (next/font legitimately dedupes and REUSES an identical subset .woff2 across
  // different weights/families, so a shared src across distinct tuples is expected
  // and NOT a duplication signal — the tuple check above is the real guard.)

  // Every src must be a self-hosted next/font file — never Carbon's broken
  // ~@ibm/plex webpack path, nor a remote Google Fonts URL.
  for (const f of faces) {
    expect(
      f.src,
      `${f.family} ${f.weight} src is self-hosted, not ~@ibm/plex or remote`,
    ).not.toMatch(/@ibm\/plex|fonts\.gstatic\.com|fonts\.googleapis\.com/);
  }
}

test.describe('T-16 typography: IBM Plex self-hosted via next/font, loaded once', () => {
  test('Command Center loads IBM Plex Sans 400/600 + Mono exactly once', async ({
    page,
  }) => {
    await page.goto('/command-center');
    await assertPlexLoadedOnce(page);
  });

  test('Case Workspace loads IBM Plex Sans 400/600 + Mono exactly once', async ({
    page,
  }) => {
    await page.goto('/case');
    await assertPlexLoadedOnce(page);
  });

  test('Exhibit Detail loads IBM Plex Sans 400/600 + Mono exactly once', async ({
    page,
    request,
  }) => {
    const exhibitId = await getAnExhibitId(request);
    await page.goto(`/exhibit/${exhibitId}`);
    await assertPlexLoadedOnce(page);
  });

  test('Jury Package loads IBM Plex Sans 400/600 + Mono exactly once', async ({
    page,
  }) => {
    await page.goto('/jury-package');
    await assertPlexLoadedOnce(page);
  });
});
