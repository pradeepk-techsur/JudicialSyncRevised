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
