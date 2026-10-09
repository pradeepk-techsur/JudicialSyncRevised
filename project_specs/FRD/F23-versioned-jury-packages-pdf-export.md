## F23: Versioned Jury Packages with PDF Export

**Description:** Replaces the current `window.print()`-based export on the Jury Package Workspace (F11) with real, generated PDF export, and adds immutable version numbering so every finalization produces a permanent, independently-retrievable record of exactly what the jury received at that point in time. Finalizing a package creates an immutable numbered snapshot (version N); a new `DRAFT` package may then be started afterward for the same case, and each prior finalized version remains independently retrievable and exportable — multiple historical `FINALIZED` versions coexist per case, which is the natural reading of "a record of exactly what the jury received" together with the PRD's plural "versioned jury packages."

**Terminology:**
- **Version:** An integer, assigned to a `JuryPackage` only at the moment it is finalized (`null` while `DRAFT`), unique per case, monotonically increasing — `(caseId, version)` is unique. The first package ever finalized for a case is version `1`; the next is version `2`, regardless of how many `DRAFT` packages were created and abandoned in between (abandoned drafts never consume a version number, since they're never finalized).
- **Most-Recent Version:** The `FINALIZED` package for a case with the highest `version` value — computed at read time (`MAX(version) WHERE caseId = :id AND status = 'FINALIZED'`), not stored as an independent flag, consistent with the project's existing principle that derived facts are computed, not independently maintained state that could drift.

**Sub-features:**
- `JuryPackage.version` (nullable integer, set only at finalization) replaces the implicit "one package per case" assumption
- A new `DRAFT` package can be created after a prior version was finalized — F05's existing rule ("a new DRAFT package must be created for subsequent changes," F05 §Validation) already permits this; this feature adds the version number that makes each resulting `FINALIZED` package independently identifiable and retrievable
- Real PDF generation via `@react-pdf/renderer` (new dependency — see §PDF Generation Mechanism below), replacing the client-side `window.print()` CSS trick
- Full per-case version history retrieval: which exhibits were included, in what classification/status state, at each finalization timestamp
- Exported PDFs reflect the exact same discrepancy-gated (F6), classification-excluded (F13/F16) exhibit set the live workspace showed at finalization time — no divergence between what was displayed and what is exported

**PDF Generation Mechanism:** `@react-pdf/renderer` is selected as the new dependency. It generates PDFs from JSX/React-component definitions in pure JavaScript, with no headless-browser binary (unlike a Puppeteer/Playwright-based HTML-to-PDF approach) — this matters specifically because the system is hosted on Vercel serverless functions (`Y3-integrations.md` §Deployment/Runtime Dependencies), where bundling and cold-starting a full Chromium binary per invocation is both heavy and operationally fragile. `@react-pdf/renderer`'s component-based API (`<Document>`, `<Page>`, `<View>`, `<Text>`) also lets the PDF layout be authored in a style idiomatic to the rest of this React/Next.js codebase, rather than introducing an unrelated templating system. **This is a new runtime dependency, explicitly flagged as distinct from F16–F22, which introduce no new dependencies.**

**Process:**
1. Finalization (`POST /api/jury-package/:id/finalize`, F05 §Process steps 5–7) is amended: immediately before setting `status = 'FINALIZED'`, the service layer computes `version = (SELECT MAX(version) FROM JuryPackage WHERE caseId = :caseId AND status = 'FINALIZED') + 1` (or `1` if no prior finalized version exists for this case), and sets it atomically in the same transaction as the status/`finalizedAt`/`finalizedBy` write (F05 §Process step 7, unchanged otherwise).
2. Once `FINALIZED` with a `version` assigned, the package and its `JuryPackageExhibit` rows remain immutable exactly as F05 already specifies (F05 §Validation: "A `FINALIZED` package is immutable") — this feature adds no new mutability rule, it adds the version number to an already-immutable artifact.
3. A deputy/clerk/admin may subsequently create a new `DRAFT` `JuryPackage` for the same case (F05 §Process step 1, unchanged) — this new draft has `version = null` until it, too, is eventually finalized, at which point it receives the next sequential version number for that case.
4. `GET /api/cases/:id/jury-package/versions` (new endpoint) lists every `JuryPackage` for the case — every `FINALIZED` version plus the current `DRAFT`, if one exists — each annotated with `isMostRecent` (computed per §Terminology, `true` only for the highest-`version` `FINALIZED` row).
5. `GET /api/jury-package/:id/export` (new endpoint) accepts a specific `JuryPackage` id (which must be `FINALIZED`) and generates a PDF server-side via `@react-pdf/renderer`, rendering the package's immutable `INCLUDED` `JuryPackageExhibit` rows (F13's `EXCLUDED` rows are never rendered into the export, exactly as they're never rendered into the live `INCLUDED` list — F13 §Outputs) as a formatted document: case identification, finalization timestamp, finalizing user, and one entry per included exhibit (label, description, classification, status at finalization).
6. The generated PDF is streamed back as `application/pdf` — a real downloadable file, not a browser print dialog. The Jury Package Workspace (F11)'s existing export control is amended to call this endpoint and trigger a file download, in place of `window.print()`.
7. Because a `FINALIZED` package's `JuryPackageExhibit` rows are immutable (step 2), re-exporting the same version at a later date always produces an identical PDF (same exhibit set, same classification/status snapshot) — the export is deterministic per version, not re-computed against the exhibits' *current* live state.
8. The Jury Package Workspace (F11) is amended to show the most-recent version prominently (via `isMostRecent`) and to surface the full version history list (step 4's endpoint) as a secondary view, so a user can locate and export any prior finalized version, not only the latest.

**Inputs:**
- `GET /api/cases/:id/jury-package/versions`: `caseId` (string/UUID, required, path parameter)
- `GET /api/jury-package/:id/export`: `id` (string/UUID, required, path parameter) — the specific `JuryPackage` id to export; must currently be `FINALIZED`
- No new inputs to the existing finalize endpoint (`POST /api/jury-package/:id/finalize`, F05) — `version` is computed server-side, never client-supplied

**Outputs:**
- `GET /api/cases/:id/jury-package/versions`: `Array<{ id, version: number | null, status, finalizedAt?, finalizedBy?, exhibitCount, isMostRecent: boolean }>`
- `GET /api/jury-package/:id/export`: binary `application/pdf` stream (not JSON)
- `POST /api/jury-package/:id/finalize` (F05, amended): response now additionally includes `version` on the returned `JuryPackage`

**Validation:**
- `version` is assigned exactly once, at finalization, and is never reassigned or recomputed afterward — it is part of the immutable finalized snapshot, identical in spirit to `finalizedAt`/`finalizedBy`
- `(caseId, version)` must be unique — enforced at the database level; two packages for the same case can never share a version number
- Export is rejected for any package with `status = 'DRAFT'` (no version exists yet to export) — a draft must be finalized first
- A `DRAFT` package's export control (if ever exposed in a future UI iteration) must be hard-disabled, not merely hidden, consistent with F05's existing hard-gate pattern for finalization itself

**Error States:**
| Scenario | HTTP Status | Error Code | Message |
|---|---|---|---|
| Export attempted on a `DRAFT` (not yet finalized) package | 422 | JURY_PACKAGE_EXPORT_NOT_FINALIZED | "Only a finalized jury package version can be exported as a PDF" |
| `GET /api/jury-package/:id/export` or `/versions` referencing a nonexistent package/case | 404 | JURY_PACKAGE_VERSION_NOT_FOUND | "No jury package version found with the given ID" |
| PDF generation fails at render time (e.g., malformed exhibit data) | 500 | PDF_GENERATION_FAILED | "Unable to generate the jury package PDF — please retry" |

**API Surface (this feature):** adds `GET /api/cases/:id/jury-package/versions`, `GET /api/jury-package/:id/export`; amends `POST /api/jury-package/:id/finalize` (F05) response to include `version` — see `Y1-api.md` §Jury Package (amended) and §Jury Package Versions (new section).

**Schema Surface (this feature):** adds `version Int?` to `JuryPackage`, with `@@unique([caseId, version])` (partial/sparse uniqueness — only enforced where `version` is non-null); no new table — the existing `JuryPackageExhibit` rows, already immutable once their parent `JuryPackage` is `FINALIZED` (F05), serve directly as the versioned snapshot with no separate snapshot table required. See `Y0-schema.md` §Jury Package (amended). **New dependency:** `@react-pdf/renderer` (server-side PDF generation) — see `Y3-integrations.md` §Deployment/Runtime Dependencies (amended).
