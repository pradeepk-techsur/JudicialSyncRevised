import { describe, it, expect } from 'vitest';
import { progressBarModel } from './TwoColorProgressBar';

// The Jury Package progress bar renders in two places (Command Center summary
// widget + Jury Package Workspace header) off the identical {clean, total} shape.
// The one piece of logic that can actually break is the ratio math, so it lives in
// a pure, rendering-free helper (`progressBarModel`) that is exercised here. The
// project's vitest harness is node-environment with no jsdom/testing-library and
// only includes `*.test.ts` — testing the extracted pure function (rather than
// adding heavy rendering-test infrastructure) is the right-sized way to lock the
// edge cases the plan's done-criteria name.

describe('progressBarModel', () => {
  it('handles total === 0 without NaN (plan done-criterion)', () => {
    const m = progressBarModel(0, 0);
    expect(Number.isNaN(m.cleanPct)).toBe(false);
    expect(m.cleanPct).toBe(0);
    expect(m.blocked).toBe(0);
    expect(m.caption).toBe('0 of 0 exhibits are clean');
  });

  it('renders a 100%-clean boundary with no blockers phrase', () => {
    const m = progressBarModel(9, 9);
    expect(m.cleanPct).toBe(100);
    expect(m.blocked).toBe(0);
    expect(m.caption).toBe('9 of 9 exhibits are clean');
  });

  it('renders a 0%-clean boundary with every exhibit a blocker', () => {
    const m = progressBarModel(0, 4);
    expect(m.cleanPct).toBe(0);
    expect(m.blocked).toBe(4);
    expect(m.caption).toBe('0 of 4 exhibits are clean · 4 blockers remain');
  });

  it('computes a partial ratio and pluralizes correctly', () => {
    const m = progressBarModel(6, 9);
    expect(m.cleanPct).toBe(67); // Math.round(6/9*100)
    expect(m.blocked).toBe(3);
    expect(m.caption).toBe('6 of 9 exhibits are clean · 3 blockers remain');
  });

  it('uses the singular "blocker" when exactly one remains', () => {
    const m = progressBarModel(8, 9);
    expect(m.blocked).toBe(1);
    expect(m.caption).toBe('8 of 9 exhibits are clean · 1 blocker remain');
  });

  it('clamps nonsensical inputs (clean > total, negatives) rather than emitting NaN', () => {
    expect(progressBarModel(50, 9).cleanPct).toBe(100);
    expect(progressBarModel(50, 9).blocked).toBe(0);
    expect(progressBarModel(-3, -3).cleanPct).toBe(0);
    expect(progressBarModel(-3, -3).caption).toBe('0 of 0 exhibits are clean');
  });
});
