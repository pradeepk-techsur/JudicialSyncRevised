import styles from './TwoColorProgressBar.module.scss';

// The ONE "clean vs. blocked" progress bar, rendering the IDENTICAL {clean}/{total}
// ratio wherever consumed: the Command Center's Jury Package summary widget AND the
// Jury Package Workspace's own header bar read the same source data, per the locked
// 08-CONTEXT standardization decision — so the two can never show a different number.
//
// The ratio math is extracted into the pure `progressBarModel` helper below so it
// can be unit-tested in this project's node-environment vitest harness (which has no
// jsdom/testing-library and only includes `*.test.ts`) without rendering React — the
// edge case that actually matters (total === 0 must not produce NaN) lives entirely
// in that pure function. See TwoColorProgressBar.test.ts.

export interface ProgressBarModel {
  blocked: number;
  cleanPct: number;
  caption: string;
}

// Pure, side-effect-free derivation of everything the bar renders. Guards
// total === 0 (and negative/over-count inputs) so the component can never emit a
// NaN width or a nonsensical caption.
export function progressBarModel(clean: number, total: number): ProgressBarModel {
  const safeTotal = Math.max(0, total);
  const safeClean = Math.min(Math.max(0, clean), safeTotal);
  const blocked = Math.max(0, safeTotal - safeClean);
  const cleanPct = safeTotal > 0 ? Math.round((safeClean / safeTotal) * 100) : 0;
  const caption =
    `${safeClean} of ${safeTotal} exhibits are clean` +
    (blocked > 0 ? ` · ${blocked} blocker${blocked === 1 ? '' : 's'} remain` : '');
  return { blocked, cleanPct, caption };
}

export function TwoColorProgressBar({
  clean,
  total,
}: {
  clean: number;
  total: number;
}) {
  const { cleanPct, caption } = progressBarModel(clean, total);
  const safeTotal = Math.max(0, total);
  const safeClean = Math.min(Math.max(0, clean), safeTotal);

  return (
    <div className={styles.container} data-testid="two-color-progress-bar">
      <div
        className={styles.track}
        role="progressbar"
        aria-valuenow={cleanPct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${safeClean} of ${safeTotal} exhibits are clean`}
      >
        <div className={styles.cleanSegment} style={{ width: `${cleanPct}%` }} />
        <div
          className={styles.blockedSegment}
          style={{ width: `${100 - cleanPct}%` }}
        />
      </div>
      <p className={styles.caption} data-testid="two-color-progress-caption">
        {caption}
      </p>
    </div>
  );
}
