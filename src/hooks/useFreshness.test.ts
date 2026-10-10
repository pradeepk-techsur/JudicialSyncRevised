import { describe, it, expect } from 'vitest';
import { computeIsStale, STALE_THRESHOLD_SECONDS } from './useFreshness';

// T-15 (LiveIndicator) — the 60s staleness boundary is the whole acceptance
// criterion ("after 60 seconds without a successful update, the indicator turns
// amber and reads Connection lost"). The derivation lives in the pure, exported
// `computeIsStale` so it is testable without rendering the hook: the project's
// vitest harness is node-environment with no jsdom/testing-library (mirrors the
// SeverityPill / TwoColorProgressBar pure-function test pattern), so a hook with
// useState/useEffect cannot be rendered here — but its pure core can.

describe('computeIsStale — the 60s LiveIndicator boundary (T-15)', () => {
  it('exposes the threshold as exactly 60 seconds', () => {
    expect(STALE_THRESHOLD_SECONDS).toBe(60);
  });

  it('is NOT stale before the first successful fetch (secondsAgo === null)', () => {
    expect(computeIsStale(null)).toBe(false);
  });

  it('is NOT stale at 59 seconds (just under the threshold)', () => {
    expect(computeIsStale(59)).toBe(false);
  });

  it('IS stale at exactly 60 seconds (the threshold is inclusive)', () => {
    expect(computeIsStale(60)).toBe(true);
  });

  it('is NOT stale at 0 seconds (a fresh success)', () => {
    expect(computeIsStale(0)).toBe(false);
  });

  it('IS stale well past the threshold', () => {
    expect(computeIsStale(120)).toBe(true);
  });

  it('IS stale whenever the query is erroring, regardless of how recent the last success was', () => {
    // An active failure IS the "connection lost" signal — it overrides a recent
    // success (even secondsAgo === 0 / null) so the indicator flips immediately.
    expect(computeIsStale(0, true)).toBe(true);
    expect(computeIsStale(null, true)).toBe(true);
    expect(computeIsStale(10, true)).toBe(true);
  });

  it('is NOT stale when under the threshold and not erroring (explicit isError=false)', () => {
    expect(computeIsStale(30, false)).toBe(false);
  });
});
