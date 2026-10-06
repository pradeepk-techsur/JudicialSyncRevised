### Flow 3: Reconstructing an Exhibit's Full History

**Trigger:** A prior ruling or event on an exhibit is challenged or questioned days later; someone needs the complete, trustworthy story assembled instantly.
**User Stories:** US-10.1, US-3.3, US-7.1
**Journey:** JRN-02.2

```
[Request arrives — "What happened to Exhibit 14?"]
    │
    ▼
[Navigate to Exhibit Detail View]
   (via Case Workspace row click, Command Center activity item,
    Jury Package row click, or Assistant citation)
    │
    ▼
[Header loads instantly: current status, current custodian,
 active discrepancy flags — the answer's headline, above the fold]
    │
    ▼
[Scroll full chronological timeline — every ledger event,
 oldest-first, in plain language]
    │
    ▼
[Optional: cross-check via "Ask ✦" — "What happened to Exhibit 14?"]
    │
    ▼
[Assistant's answer and the timeline agree exactly —
 same events, same citations]
    │
    ▼
[Report back verbally with full confidence]
```

**Steps:**
1. **Arrive at the exhibit.** Whether from a Case Workspace row click, a Command Center flagged item, a Jury Package row, or an assistant citation pill, the destination is always the same Exhibit Detail View — one canonical "full story" surface (US-9.2, US-10.1).
2. **Headline facts load above the fold.** Current status, current custodian, and any active discrepancy flags render in a prominent header block before the timeline even renders — answering the most common question ("where does this stand right now") without scrolling.
3. **Timeline renders complete, in order.** Every `ExhibitEvent` — status changes, objections raised, rulings recorded, custody transfers — appears as one chronological entry, translated to plain language ("Status changed from Offered to Admitted," not raw enum values) (US-10.1). No "show more" pagination — FRD explicitly requires complete history, not "recent N events."
4. **Each entry is self-contained.** Actor name, timestamp, and a one-line summary — scannable in seconds, matching exactly what the assistant's `getExhibitHistory` tool would state (US-10.1, US-3.3).
5. **Independent cross-check available.** The user can open the assistant and ask the same question as a trust-verification step — the screen and the assistant are guaranteed to agree because both read the identical service-layer function (JRN-02.2 Delight Opportunity).
6. **Sealed exhibit behavior.** If the exhibit is sealed and the viewing role is unauthorized, this entire flow dead-ends at a plain "exhibit not found" — visually and textually identical to a truly nonexistent exhibit ID, never revealing that sealed material exists (US-10.2).

**Key UX Risk Guarded Against:** If the timeline were ever incomplete or required cross-referencing a second screen, the deputy/judge would revert to manually reconstructing fragments — undermining the entire value proposition (JRN-02.2 Risk of Abandonment). Completeness and single-screen sufficiency are non-negotiable design constraints here.
