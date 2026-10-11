// Dependency-free WCAG 2.x relative-luminance + contrast-ratio helpers.
//
// T-12 (09-14): the accessibility sweep in e2e/accessibility-audit.spec.ts needs
// the SAME contrast arithmetic 09-02 already wrote inline in
// src/components/shared/SeverityPill.test.ts to prove SeverityPill's four tones
// meet AA. Rather than duplicate the formula a third time (or add
// @axe-core/playwright, which this phase's "no npm dependency beyond next/font"
// constraint forbids), the ~15 lines of pure arithmetic are lifted here as a
// tiny shared module. It is NOT a new dependency — it is first-party code, the
// same formula, in one place. Accepts either a `#rrggbb` hex string or an
// `rgb(r, g, b)` / `rgba(r, g, b, a)` string (what getComputedStyle returns),
// so the Playwright spec can feed it rendered colors verbatim.

// Parse `#rgb`, `#rrggbb`, or `rgb()/rgba()` into an [r, g, b] triple (0-255).
export function parseColor(input: string): [number, number, number] {
  const s = input.trim();

  if (s.startsWith('#')) {
    const hex = s.slice(1);
    if (hex.length === 3) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      return [r, g, b];
    }
    return [
      parseInt(hex.substr(0, 2), 16),
      parseInt(hex.substr(2, 2), 16),
      parseInt(hex.substr(4, 2), 16),
    ];
  }

  const m = s.match(/rgba?\(([^)]+)\)/i);
  if (m) {
    const parts = m[1].split(',').map((p) => parseFloat(p.trim()));
    return [parts[0], parts[1], parts[2]];
  }

  throw new Error(`Unrecognized color format: ${input}`);
}

// Standard WCAG 2.x relative luminance for an sRGB color (hex or rgb string).
export function relativeLuminance(color: string): number {
  const channels = parseColor(color).map((c) => c / 255);
  const linear = channels.map((c) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4),
  );
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

// Standard WCAG contrast ratio between two colors: (L1 + 0.05) / (L2 + 0.05).
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}
