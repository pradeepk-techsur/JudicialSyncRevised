'use client';

import { useEffect } from 'react';
import {
  Header as CarbonHeader,
  HeaderName,
  HeaderGlobalBar,
  Select,
  SelectItem,
  Button,
} from '@carbon/react';
import { useRoleStore } from '@/stores/roleStore';
import { useAssistantStore } from '@/stores/assistantStore';
import styles from './Header.module.scss';

export function Header() {
  const { caseNumber, users, activeUserId, setActiveUser, hydrate } = useRoleStore();
  const togglePanel = useAssistantStore((s) => s.togglePanel);

  useEffect(() => {
    if (caseNumber) return; // already hydrated
    fetch('/api/case')
      .then((res) => res.json())
      .then(hydrate)
      .catch(() => {
        // Demo-scoped: no retry/error UI for this one-time bootstrap call —
        // a failure here means the seed never ran, which every other screen's
        // own load-failure state already surfaces.
      });
  }, [caseNumber, hydrate]);

  return (
    // Carbon's UI Shell <Header> renders the <header> landmark. `no-print` is
    // preserved so the Jury Package print/export (06-01's print CSS) still hides
    // the chrome.
    //
    // Phase 8 (08-04) simplified this header to match the reference screenshots:
    // the raw case-number text node and the discrepancy-count badge are both
    // GONE from the shared header entirely. The case identifier now lives in each
    // screen's own subtitle (built in the wave-3 screen plans); the discrepancy
    // signal moves to the Command Center's stat-card row / "Needs your attention"
    // feed (08-CONTEXT §Header layout: "Do not add either element back in").
    <CarbonHeader aria-label="JudicialSync" className="no-print">
      <HeaderName href="/" prefix="">
        JudicialSync
      </HeaderName>
      <HeaderGlobalBar>
        {/* Role switcher — Carbon's `Select` wraps a REAL native <select> with a
            REAL <label htmlFor>, so Playwright's option-count / option-text /
            option:checked assertions against a native <select> keep working. The
            accessible name Playwright matches on is forced to exactly "Switch
            active role" via the `aria-label` passthrough prop (Carbon spreads
            `...other` onto the <select>, and aria-label overrides the <label>
            text as the accessible name), independent of `hideLabel` — so the
            accessible name is unaffected by the visible label's presence.

            T-09: this switcher silently changes what the user can DO — mistaking
            it for a real account menu in a courtroom-facing demo is a genuine
            safety hazard. It is therefore (a) kept recognizable as a test
            control via the explanatory `title` tooltip (the VISIBLE "Demo role:"
            label text itself was dropped per UAT-16 — see below), and (b) gated
            behind NEXT_PUBLIC_DEMO_MODE so a future real-auth deployment can
            hide it with a build flag (defaults to ENABLED — only the literal
            string 'false' disables it, preserving current demo behavior exactly
            when unset). Per 09-CONTEXT decision #1 this is a UX/safety
            affordance only; the server-side per-write-path role gates remain
            the actual authority, unchanged.

            UAT-16: the visible "Demo role:" label text is hidden via Carbon's
            own `hideLabel` (applies `cds--visually-hidden` to the <label> — the
            element and its `htmlFor` association stay in the DOM, so the
            `aria-label` passthrough and every existing Playwright
            getByLabel('Switch active role') locator are completely unaffected).
            `className={styles.roleSwitcherWrap}` is forwarded by Carbon onto the
            outer `.cds--form-item` wrapper div, absolutely-positioning the
            switcher at the SAME 17.5rem offset every page title's own box
            already sits at (Header.module.scss). */}
        {process.env.NEXT_PUBLIC_DEMO_MODE !== 'false' && (
          <Select
            id="role-switcher"
            labelText="Demo role:"
            hideLabel
            className={styles.roleSwitcherWrap}
            inline
            aria-label="Switch active role"
            title="Demo/test control — switches the active persona, not a real login."
            value={activeUserId ?? ''}
            onChange={(e) => setActiveUser(e.target.value)}
          >
            {users.map((u) => (
              <SelectItem key={u.id} value={u.id} text={`${u.name} (${u.role})`} />
            ))}
          </Select>
        )}
        {/* "Ask Pivota" uses a plain Carbon ghost Button rather than
            HeaderGlobalAction: the latter is icon-only (children expected to be
            an Icon), but app-shell.spec.ts asserts the button's VISIBLE text
            matches /Ask/, so a text Button preserves the label faithfully. All
            three identifying attributes (data-testid, aria-label, title) are kept
            verbatim — only the visible text changed from "Ask ✦" to "Ask Pivota"
            per the Phase 8 reference screenshots. */}
        <Button
          kind="ghost"
          type="button"
          onClick={togglePanel}
          data-testid="ask-assistant"
          aria-label="Open Pivota Assistant"
          title="Ask the Pivota Assistant"
        >
          Ask Pivota
        </Button>
      </HeaderGlobalBar>
    </CarbonHeader>
  );
}
