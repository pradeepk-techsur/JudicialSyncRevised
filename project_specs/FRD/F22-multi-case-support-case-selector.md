## F22: Multi-Case Support with Case Selector

**Description:** Replaces the current hardcoded single-demo-case assumption (`DEMO_CASE_NUMBER`) with the ability to list active cases and explicitly select which one is active for every screen and the assistant. **This requires no database schema change** — `Case`, `User`, `Exhibit`, `JuryPackage`, and `AssistantConversation` are already properly `caseId`-scoped via foreign keys in the existing schema (`Y0-schema.md`), per the prior TechArch note that recorded case-partitioning as structurally present but not enforced. This feature is confirmed to be a service/API/UI change only.

**Terminology:**
- **Active Case:** The `caseId` the client currently has selected, carried on every request exactly as `requestingUserRole` already is today (a per-request parameter derived from client-side state, not a server-side session value) — the server remains stateless with respect to "which case is active," consistent with the existing architecture's treatment of role.
- **Case Selector:** The new UI control (app header, alongside the existing role switcher) allowing a user to list and switch the active case.

**Sub-features:**
- New `GET /api/cases` endpoint listing all cases available to the current user
- Case selector UI control in the app header, alongside the role switcher
- `GET /api/case` (singular, implicit `DEMO_CASE_NUMBER`) evolves into `GET /api/cases/:id` (explicit, parameterized)
- `getActiveCaseWithUsers()` (currently no-argument, implicit) becomes `getActiveCaseWithUsers(caseId)` (explicit parameter)
- Every existing query that today implicitly scopes to "the" case via `DEMO_CASE_NUMBER` is amended to scope explicitly to the client-selected `caseId`
- Seed data extended to include a second `Case` with its own exhibits, so multi-case switching is demonstrable, not just structurally possible

**Process:**
1. On initial app load, the client calls the new `GET /api/cases` endpoint, which lists every `Case` row (`{ id, caseNumber, title, court, createdAt }`) — no role restriction on this read (case existence is not sensitive; exhibit-level sealed/classification visibility, F16/`00-header.md` §Role-Based Visibility, remains the sensitive boundary and is unaffected).
2. If the client has no previously-selected `caseId` (first load, or a fresh session), it defaults to the first case in the list (by `createdAt` ascending, i.e., the original seeded demo case) — preserving the existing single-case demo script's zero-interaction behavior with no selector action required.
3. The user may open the Case Selector (header, alongside the role switcher) and choose a different case; this updates client-side state (a new `activeCaseStore`, modeled on the existing role-switcher's zustand store) and triggers every open screen (Command Center, Case Workspace, Exhibit Detail, Jury Package Workspace) and the assistant to refetch against the newly-selected `caseId` — the same refetch mechanism already used when the role switcher changes (`00-header.md`'s existing per-request role plumbing; `caseId` is now carried identically, alongside role, on every request).
4. `getActiveCaseWithUsers(caseId)` (amended from its current no-argument form) fetches the specified case plus its user roster — the bootstrap screen (`GET /api/cases/:id`, replacing `GET /api/case`) returns the identical shape as today's single-case bootstrap, just explicitly parameterized.
5. Every service function that currently queries "the" case implicitly via the `DEMO_CASE_NUMBER` constant (exhibit list, search, activity feed, discrepancies, jury package, assistant tool calls) is amended to accept and filter on the caller-supplied `caseId` — this is additive query-parameter plumbing on functions whose underlying tables already carry a `caseId` foreign key; no new join, no new index, no new table.
6. Role-based visibility (`00-header.md` §Role-Based Visibility) and every other existing per-request scoping rule continue to apply exactly as before, now additionally and simultaneously scoped by the selected `caseId` — a user's role visibility rules do not change per-case, but the exhibit set they're evaluated against is now explicitly the selected case's set, not an implicit single case's.
7. The assistant's tool wrappers (F7) receive `caseId` as part of the same per-turn context as `userId`/`role` (F07 §Inputs already lists `caseId` as a required input) — this feature changes only where that `caseId` value comes from (an explicit client selection, not an implicit constant), not the tool contract itself.
8. The seed loader (F0 §Process) is extended to create a second `Case` row with its own seeded exhibits and history, independent of the original demo case, so a reviewer can demonstrate switching between two populated cases without a redeploy or manual data entry.

**Inputs:**
- `GET /api/cases`: none (lists all cases unconditionally)
- `GET /api/cases/:id`: `id` (string/UUID, required, path parameter) — replaces the current no-argument `GET /api/case`
- Every amended existing endpoint (exhibits list/search, activity, discrepancies, jury package, assistant chat): `caseId` is now an explicit required parameter/path segment on each, carried from the client's Case Selector state — this is not a new conceptual input (every one of these endpoints already requires a case context today, just implicitly), only a change from implicit to explicit sourcing

**Outputs:**
- `GET /api/cases`: `Array<{ id, caseNumber, title, court, createdAt }>`
- `GET /api/cases/:id`: identical shape to today's `GET /api/case` response (case + user roster) — no shape change, only explicit parameterization

**Validation:**
- `GET /api/cases/:id` rejects a nonexistent `id` with the existing `CASE_NOT_FOUND` (404) — reused, not new
- Every amended endpoint's `caseId` must reference an existing `Case` — same `CASE_NOT_FOUND` reuse
- Switching the active case client-side must trigger a refetch on every open screen and the assistant's working context — no screen may silently continue displaying data scoped to a previously-selected case after a switch (stale single-case assumption is explicitly disallowed, per the PRD's F22 capability)
- Cross-case data leakage is explicitly disallowed: a query scoped to `caseId = A` must never return rows belonging to `caseId = B`, even transiently — since every relevant table already carries a `caseId` foreign key, this is enforced by adding an explicit `WHERE caseId = :selectedCaseId` clause (or equivalent Prisma filter) to every amended query, not by any new isolation mechanism

**Error States:**
| Scenario | HTTP Status | Error Code | Message |
|---|---|---|---|
| `GET /api/cases/:id` (or any amended endpoint) referencing a nonexistent case | 404 | CASE_NOT_FOUND | "No case found with the given ID" *(reused, unchanged)* |

**API Surface (this feature):** adds `GET /api/cases`; amends `GET /api/case` → `GET /api/cases/:id` (F0); amends every existing case-scoped endpoint (F4 search, F8 activity, F6 discrepancies, F5 jury package, F7 assistant chat) to take `caseId` explicitly rather than implicitly — see `Y1-api.md` §Cases (new section) and inline amendment notes on each affected existing section.

**Schema Surface (this feature):** **none.** `Case`, `User`, `Exhibit`, `JuryPackage`, and `AssistantConversation` already carry `caseId` foreign keys in the existing schema (`Y0-schema.md` §Core Entities, §Jury Package, §Assistant) — this feature adds no table, column, index, or constraint. Confirmed explicitly: this is a service/API/UI-only change.
