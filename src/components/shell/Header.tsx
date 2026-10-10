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
            text as the accessible name), so the visible label is free to change.

            T-09: this switcher silently changes what the user can DO — mistaking
            it for a real account menu in a courtroom-facing demo is a genuine
            safety hazard. It is therefore (a) labeled "Demo role:" with an
            explanatory tooltip making clear it is a test control, not a login,
            and (b) gated behind NEXT_PUBLIC_DEMO_MODE so a future real-auth
            deployment can hide it with a build flag (defaults to ENABLED — only
            the literal string 'false' disables it, preserving current demo
            behavior exactly when unset). Per 09-CONTEXT decision #1 this is a
            UX/safety affordance only; the server-side per-write-path role gates
            remain the actual authority, unchanged. */}
        {process.env.NEXT_PUBLIC_DEMO_MODE !== 'false' && (
          <Select
            id="role-switcher"
            labelText="Demo role:"
            inline
            hideLabel={false}
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
