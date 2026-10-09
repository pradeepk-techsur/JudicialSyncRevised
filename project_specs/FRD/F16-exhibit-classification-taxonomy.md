## F16: Exhibit Classification Taxonomy

**Description:** Introduces a formal, three-value `ExhibitClassification` enum (`TRIAL`, `CHAMBERS_EX_PARTE`, `SEALED`) captured at exhibit intake and immutable thereafter, replacing the `isSealed` boolean's role as the authoritative input to jury-package exclusion (F13) and role-based visibility (`00-header.md` §Role-Based Visibility). A boolean can distinguish only two states; this product needs three, since chambers-ex-parte material and sealed material are legally distinct categories that nonetheless both require the same hard exclusion from a jury package. Reclassification after intake is explicitly out of scope — if an exhibit's classification is ever wrong, that is a data-correction concern handled outside this feature, not a supported state transition.

**Terminology:**
- **Classification:** One of `TRIAL` (ordinary trial exhibit, fully eligible for jury inclusion), `CHAMBERS_EX_PARTE` (in-camera/sidebar submission visible only to chambers), or `SEALED` (sealed by court order). Set exactly once, at intake, never changed.
- **Derived `isSealed`:** The pre-existing `Exhibit.isSealed` boolean column, retained for backward compatibility with every existing read path (role-visibility gate, F13's pre-Phase-7.1 filter), but as of this feature it is written exactly once — at creation, synchronously, in the same write as `classification` — as `isSealed = (classification !== 'TRIAL')`. It is never set independently of `classification` again.

**Design decision (boolean vs. orthogonal dimension):** `isSealed` is retained as a derived, write-once mirror of `classification` rather than kept as an independently-settable, orthogonal field, because a single source of truth with one place where sensitivity is decided eliminates any possibility of the boolean and the taxonomy disagreeing with each other — a risk an orthogonal second dimension would otherwise require ongoing application-level synchronization to avoid.

**Sub-features:**
- `classification` required at exhibit creation (`POST /api/exhibits`, F0) — no exhibit can exist unclassified
- `classification` immutable after creation — no update endpoint, no reclassification flow, in this version
- `Exhibit.isSealed` computed once, at creation, directly from `classification` — removed as a direct client-settable input
- F13's jury-candidacy exclusion filter extended from a boolean check (`isSealed = false`) to a classification-set check (`classification = 'TRIAL'`)
- Role-based visibility (`00-header.md` §Role-Based Visibility) continues to read `isSealed`, which is now always classification-consistent by construction — no visibility-table changes required

**Process:**
1. At exhibit creation (`POST /api/exhibits`, F0 §Process), the caller supplies `classification` as a required field — not optional, not defaulted.
2. The service layer validates `classification` is one of the three enum values before any write occurs.
3. Within the same transaction that creates the `Exhibit` row, the service layer sets `isSealed = (classification !== 'TRIAL')` directly — this is the only write path for `isSealed` in this and all future versions; the creation API no longer accepts `isSealed` as a independent client input (a client-supplied `isSealed` value in the request body, if present, is ignored and overwritten by the derived value — see Validation).
4. `computeJuryCandidates` (F5 §Process step 1, amended by F13 §Process step 1) is further amended: its candidate query now filters `exhibit.classification = 'TRIAL'` in the same query as the `ADMITTED`-status filter, in place of the prior `exhibit.isSealed = false` filter. Both `CHAMBERS_EX_PARTE` and `SEALED` classifications are hard-excluded identically — neither can ever acquire an `INCLUDED` `JuryPackageExhibit` row via the normal computation path, matching F13's existing "never passed into discrepancy evaluation" guarantee (F13 §Process step 2), now driven by the three-value field instead of the boolean.
5. Role-based visibility checks (`visibility.ts`'s `canViewSealed`-style gate, used by F4/F7/F9/F10) continue to branch on `Exhibit.isSealed` exactly as before — because `isSealed` is now always classification-consistent by construction (step 3), no call site in `visibility.ts` requires modification; `CHAMBERS_EX_PARTE` material is therefore already treated with the same visibility rigor as `SEALED` material everywhere the boolean previously governed, satisfying the PRD's F16 capability without a second visibility pass keyed on `classification` directly.
6. No reclassification endpoint exists. If a future change to an exhibit's classification is ever required, it is handled as a separate, explicitly out-of-scope concern (e.g., a manual data correction outside the application, or a future audited reclassification feature not designed here).
7. Seed data (F0 §Process step 5) is extended so at least one seeded exhibit uses `CHAMBERS_EX_PARTE` and at least one uses `SEALED`, distinct from each other, so the demo can show both categories independently hard-excluded from a jury package — not merely a single sealed example as before.

**Inputs:**
- `classification` (enum: `TRIAL` | `CHAMBERS_EX_PARTE` | `SEALED`, required): supplied at `POST /api/exhibits` (F0) — no default value
- All other `POST /api/exhibits` inputs are unchanged from F0 §Inputs

**Outputs:**
- `Exhibit` record now includes `classification` and a classification-consistent `isSealed` (both present on every exhibit-read response — F0/F4/F9/F10 response shapes are additive, not altered)
- `computeJuryCandidates` / `JuryPackageExhibit` outputs are unaffected in shape — only the candidate-set membership rule changes (F13's exclusion behavior is preserved, now classification-driven)

**Validation:**
- `classification` must be supplied and must be one of the three enum values — reject with 422 otherwise; an exhibit can never exist in an unclassified state
- A client-supplied `isSealed` value in the `POST /api/exhibits` request body, if present, is ignored — the server always derives and overwrites it from `classification`, never trusting a client-asserted boolean for a security-relevant exclusion/visibility input
- `classification` cannot be changed by any existing or new endpoint in this version — no route accepts a `classification` update; this is enforced by omission (no such route exists), not by a runtime immutability check on an update path
- F13's exclusion validation (F13 §Validation: "exclusion takes precedence over and is evaluated independently of F6's `discrepancyStatus`") is unchanged in substance — it now reads `classification != 'TRIAL'` instead of `isSealed = true` to determine the same hard-exclusion outcome

**Error States:**
| Scenario | HTTP Status | Error Code | Message |
|---|---|---|---|
| `classification` missing at exhibit creation | 422 | CLASSIFICATION_REQUIRED | "classification is required and must be one of: TRIAL, CHAMBERS_EX_PARTE, SEALED" |
| `classification` supplied with an invalid value | 422 | INVALID_CLASSIFICATION | "classification must be one of: TRIAL, CHAMBERS_EX_PARTE, SEALED" |

**API Surface (this feature):** amends `POST /api/exhibits` (F0) to require `classification` in the request body; amends the candidate computation behind `POST /api/cases/:id/jury-package` (F5/F13) to filter on `classification` instead of `isSealed` — see `Y1-api.md` §Exhibits and §Jury Package (amended). No new endpoints.

**Schema Surface (this feature):** adds enum `ExhibitClassification` and column `Exhibit.classification` (required); `Exhibit.isSealed` is retained unchanged in type but is now documented as write-once/derived at creation time — see `Y0-schema.md` §Core Entities (amended).
