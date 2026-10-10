---
phase: 9
status: clean
blockers: 0
warnings: 0
files_reviewed: 16
files_reviewed_list:
  - e2e/app-shell.spec.ts
  - e2e/case-workspace.spec.ts
  - src/app/api/cases/[id]/activity/route.test.ts
  - src/app/api/cases/[id]/attention-feed/route.test.ts
  - src/app/api/cases/[id]/custody-by-custodian/route.test.ts
  - src/app/api/exhibits/route.test.ts
  - src/components/case/ExhibitTable.module.scss
  - src/components/shell/ActiveRoleBanner.module.scss
  - src/components/shell/Header.module.scss
  - src/components/shell/Header.tsx
  - src/data/seed.ts
  - src/services/activity.test.ts
  - src/services/attentionFeed.test.ts
  - src/services/custodyByCustodian.test.ts
  - src/services/exhibits.test.ts
  - src/services/exhibits.ts
reviewed_at: 2026-10-10T22:23:48Z
iteration: 1
---

# Phase 9 Code Review (gap-closure wave: 09-18, 09-19, 09-20)

## BLOCKERs

None found.

## WARNINGs

None found.

## Verification performed (not just read-through)

- `npx tsc --noEmit` — clean, tree-wide, 0 errors.
- `npm run build` — exit 0, all 32 routes compiled.
- `npx vitest run` on all 8 files touched/depended-on by 09-18's `actorUserId` gate (`exhibits.test.ts`, `activity.test.ts`, `attentionFeed.test.ts`, `custodyByCustodian.test.ts`, and the 4 corresponding route `.test.ts` files) — **64/64 passing**.
- `npx playwright test e2e/app-shell.spec.ts --workers=1` against the live running app (docker compose) — **14/14 passing**, including both new UAT-9/UAT-16 regression tests.
- `npx playwright test e2e/case-workspace.spec.ts --workers=1` against the live running app — **19/20 passing**; the one failure (`T-07 ... "Showing N of M" with N <= M`, line 368) is a pre-existing, seed-data-dependent flake from 09-07's witness filter, unrelated to any file in this wave (confirmed: it's not in the `files_modified` list of 09-18/09-19/09-20, and both SUMMARY.md files independently document it as reproduced-as-already-failing before their own changes). Correctly scoped out, not a regression introduced by this wave.
- Read the installed `@carbon/react`/`@carbon/styles` source directly (not assumed) to confirm: (a) `TableHeader`/`TableCell` forward `className` straight onto the `<th>`/`<td>`, so `.colChevron`/`.chevronCell` really do land on the table's actual last column; (b) Carbon's own `.cds--data-table th:last-of-type { inline-size: auto; position: static; }` rule exists exactly where 09-19's plan said it does, confirming the specificity-fight root cause and that the compound selector fix is a real, necessary countermeasure (not a cargo-culted one); (c) `Select`'s `hideLabel` only toggles a `cds--visually-hidden` class on the `<label>` and is fully independent of the `aria-label` passthrough, confirming 09-20's accessibility claim.

## Findings detail (candidates considered and refuted)

- **09-18 (role gate on createExhibit):** Diffed `exhibits.ts` byte-for-byte against the plan's prescribed code — matches exactly. Confirmed the role check sits strictly after zod validation and strictly before `prisma.exhibit.create` (no write-before-check race). Confirmed `RoleNotPermittedError` maps to 403 `ROLE_NOT_PERMITTED` via `errorResponse`/`AppError`. Grepped every `createExhibit(` call site in the repo (31 total) — every one supplies a role-appropriate (`DEPUTY`/`CLERK`/`ADMIN`) `actorUserId`; none accidentally passes a `JUDGE`/`ATTORNEY`/`CHAMBERS_STAFF` id into the role-gated field. New tests (`exhibits.test.ts`'s "role gate" describe block, `route.test.ts`'s 403 and 422 tests) correctly assert zero rows created on rejection. Considered and refuted a potential cross-case actor-id IDOR (an `actorUserId` from a different case's `User` row could in principle pass the role check) — this is a pre-existing pattern identical to `custody.ts`'s `recordCustodyTransfer` (which also never cross-checks `actor.caseId` against the target case), the app is single-case-per-deployment by design (`DEMO_CASE_NUMBER` constant, no session/multi-tenant infra per `TechArch §5.1`), and 09-CONTEXT decision #1 explicitly scopes this plan to mirroring the existing `custody.ts` pattern byte-for-byte, not introducing new cross-case validation. Not a regression introduced by this plan — out of scope, consistent with the rest of the codebase.
- **09-19 (ExhibitTable column fix):** Confirmed the Carbon `th:last-of-type` override is real (read the vendored SCSS directly) and that the compound selector `.table :global(.cds--data-table) th:last-of-type.colChevron` has sufficient specificity to win (3 classes + tag vs. Carbon's 1 class + tag — compound selector wins by one additional class). Confirmed `td:last-of-type.chevronCell` correctly targets the `<td>` Carbon's `TableCell` renders with the forwarded `className`. Live Playwright run confirms zero pill-to-cell overlap across every seeded row and Description > 1.5× Label width.
- **09-20 (ActiveRoleBanner / Header):** Confirmed `16rem` matches the shared sidebar rail-width constant used identically in `AppShell.module.scss` (`.body { padding-left: 16rem }`) and `Sidebar.module.scss`'s rail width (`mini-units(32)` = 0.5rem × 32 = 16rem). Confirmed `17.5rem` = `16rem` sidebar + `1.5rem` main padding, matching `AppShell.module.scss`'s `.main { padding: 1.5rem }`. Confirmed Carbon's fixed-position `<header>` (`position: fixed; inset-inline: 0`) is the correct absolute-positioning containing block for `.roleSwitcherWrap`, and that `hideLabel` is independent of the `aria-label` passthrough (read `Select.js` source directly). Both new tests pass live.

## Cross-file seams checked

- `src/app/api/exhibits/route.ts` → `src/services/exhibits.ts#createExhibit` — route passes the full body generically; `createExhibit`'s own zod schema validates `actorUserId` presence (422) and the role gate throws 403; `errorResponse` maps both correctly. OK.
- `src/services/exhibits.ts#createExhibit` (new required `actorUserId`) → every caller (`src/data/seed.ts`, 9 test files, 31 call sites total) — grepped and manually verified every call site supplies a `DEPUTY`/`CLERK`/`ADMIN` actor already in scope in that file's own fixtures. OK.
- `src/components/case/ExhibitTable.tsx` (`.colChevron`/`.chevronCell`/`.colFlags` classNames) → `ExhibitTable.module.scss`'s new compound selectors — confirmed the classNames referenced in the TSX exactly match the SCSS selectors' trailing class names. OK.
- `src/components/shell/Header.tsx` (`className={styles.roleSwitcherWrap}`, `hideLabel`) → `src/components/shell/Header.module.scss` (`.roleSwitcherWrap`) — confirmed Carbon's `Select` forwards `className` onto the `.cds--form-item` wrapper div (read `Select.js` source) and that the `aria-label`/`htmlFor` chain Playwright's `getByLabel('Switch active role')` depends on is untouched by `hideLabel`. OK.
- `src/components/shell/ActiveRoleBanner.module.scss` (new `padding-inline-start: 16rem`) → `src/components/shell/AppShell.module.scss`/`Sidebar.module.scss` (16rem rail-width constant) — values match; confirmed via the Carbon `mini-units` function (`$unit: 0.5rem`) that `SideNav`'s `mini-units(32)` literally equals `16rem`. OK.
- `e2e/app-shell.spec.ts` / `e2e/case-workspace.spec.ts` new tests → live component output (`data-testid`, `aria-label`, class names referenced) — all locators resolve; both spec files run green against the live app (14/14 and 19/20 respectively, the one failure pre-existing and out of scope). OK.
- Plan-declared `integration_contracts` (09-18/09-19/09-20 frontmatter `verify:` greps) — spot-checked each grep pattern against the actual file contents; all three contracts are satisfied verbatim.
