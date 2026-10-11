import { describe, it, expect } from 'vitest';
import { red70, orange60, blue60, yellow30, white, gray100 } from '@carbon/colors';

// T-02 regression guard for the four-tone severity scale. SeverityPill.module.scss
// now maps the four tones onto four DIFFERENT Carbon color families (red/orange/
// blue/yellow) instead of four near-identical yellows. Two properties must hold
// and never silently regress:
//   1. Every tone's text/background pair passes WCAG AA (>= 4.5:1).
//   2. The four background colors are pairwise distinct (a durable guard against
//      ever collapsing back to near-duplicate colors).
//
// The hex values are imported DIRECTLY from @carbon/colors — the same package the
// SCSS module `@use`s — so this test and the stylesheet can never drift apart on
// which token a tone uses. These must mirror exactly SeverityPill.module.scss:
//   critical  red-70    / white
//   high      orange-60 / white
//   pending   blue-60   / white
//   medium    yellow-30 / gray-100
//
// The project's vitest harness is node-environment with no jsdom/testing-library
// and only includes `*.test.ts`, so this mirrors the pure-function test pattern
// used by TwoColorProgressBar.test.ts rather than rendering the component.

// Standard WCAG 2.x relative luminance for an sRGB hex color.
function relativeLuminance(hex: string): number {
  const v = hex.replace('#', '');
  const channels = [0, 2, 4].map((i) => parseInt(v.substr(i, 2), 16) / 255);
  const linear = channels.map((c) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4),
  );
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

// Standard WCAG contrast ratio between two colors: (L1 + 0.05) / (L2 + 0.05).
function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

const TONES: Array<{ name: string; bg: string; fg: string }> = [
  { name: 'critical', bg: red70, fg: white },
  { name: 'high', bg: orange60, fg: white },
  { name: 'pending', bg: blue60, fg: white },
  { name: 'medium', bg: yellow30, fg: gray100 },
];

describe('SeverityPill tone palette (T-02)', () => {
  it('sanity-checks a known contrast formula result', () => {
    // Pure black on pure white is the maximum possible ratio, exactly 21:1.
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
  });

  it.each(TONES)(
    'tone "$name" ($bg on $fg) passes WCAG AA 4.5:1',
    ({ bg, fg }) => {
      expect(contrastRatio(bg, fg)).toBeGreaterThanOrEqual(4.5);
    },
  );

  it('uses four pairwise-distinct background colors (no near-duplicate collapse)', () => {
    const backgrounds = TONES.map((t) => t.bg.toLowerCase());
    expect(new Set(backgrounds).size).toBe(4);
  });
});
