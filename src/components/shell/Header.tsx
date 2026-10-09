'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
import { useDiscrepancyCount } from '@/hooks/useDiscrepancyCount';

export function Header() {
  const { caseNumber, users, activeUserId, setActiveUser, hydrate } = useRoleStore();
  const togglePanel = useAssistantStore((s) => s.togglePanel);
  // Case-wide OPEN-discrepancy count from the SAME shared hook the sidebar count
  // pill (JuryPackageNavItem) uses — no second discrepancy query is introduced.
  const { openCount } = useDiscrepancyCount();
  const router = useRouter();

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
    // the chrome. The case number stays a plain text node (matchable via
    // getByText(/Case: 2026-CR-0142/)) adjacent to the product HeaderName.
    <CarbonHeader aria-label="JudicialSync" className="no-print">
      <HeaderName href="/" prefix="">
        JudicialSync
      </HeaderName>
      <span className="cds--header__case-number">
        {caseNumber ? `Case: ${caseNumber}` : 'Loading case…'}
      </span>
      <HeaderGlobalBar>
        {/* Labeled discrepancy-count indicator (UX-Mockup §App Shell layout:
            `[Case: ...]  [⚠ 1]  [Role: ... ▾] [Ask ✦]`). Sourced from the SHARED
            useDiscrepancyCount query, it shows the case-wide count of OPEN
            discrepancy flags paired with a visible aria-label ("N open
            discrepancies") readable without a hover, and navigates to the Command
            Center's Discrepancies panel on click. When the count is zero the
            element is COMPLETELY ABSENT from the DOM (not rendered-and-hidden) —
            never a bare, unexplained "0" — which is the common case against the
            fresh default seed (Labeled Header Indicator pattern's "or not rendered
            at all" half). Identical on every screen since it lives in the one
            shared Header. */}
        {openCount > 0 && (
          <Button
            kind="ghost"
            type="button"
            onClick={() => router.push('/command-center#discrepancies')}
            data-testid="header-discrepancy-indicator"
            aria-label={`${openCount} open discrepancies`}
            title={`${openCount} open discrepancies`}
          >
            ⚠ {openCount}
          </Button>
        )}
        {/* Role switcher — Carbon's `Select` wraps a REAL native <select> with a
            REAL <label htmlFor>, so Playwright's option-count / option-text /
            option:checked assertions against a native <select> keep working. The
            visible label stays "Role:"; the accessible name Playwright matches on
            is forced to exactly "Switch active role" via the `aria-label`
            passthrough prop (Carbon spreads `...other` onto the <select>, and
            aria-label overrides the <label> text as the accessible name). */}
        <Select
          id="role-switcher"
          labelText="Role:"
          inline
          hideLabel={false}
          aria-label="Switch active role"
          value={activeUserId ?? ''}
          onChange={(e) => setActiveUser(e.target.value)}
        >
          {users.map((u) => (
            <SelectItem key={u.id} value={u.id} text={`${u.name} (${u.role})`} />
          ))}
        </Select>
        {/* "Ask ✦" uses a plain Carbon ghost Button rather than
            HeaderGlobalAction: the latter is icon-only (children expected to be
            an Icon), but app-shell.spec.ts asserts the button's VISIBLE text
            matches /Ask/, so a text Button preserves the label faithfully. All
            three identifying attributes are kept verbatim. */}
        <Button
          kind="ghost"
          type="button"
          onClick={togglePanel}
          data-testid="ask-assistant"
          aria-label="Open Pivota Assistant"
          title="Ask the Pivota Assistant"
        >
          Ask ✦
        </Button>
      </HeaderGlobalBar>
    </CarbonHeader>
  );
}
