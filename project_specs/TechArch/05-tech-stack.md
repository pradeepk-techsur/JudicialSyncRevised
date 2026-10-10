
## 6. Technology Stack

This stack is adopted directly from the PRD (§4 Technical Architecture) and corroborated by `.planning/research/SUMMARY.md`/`ARCHITECTURE.md` as the current (Oct 2026), well-documented toolkit for "chat over app data via tool-calling." No component below was chosen speculatively — each maps to a specific requirement in the FRD.

### 6.1 Core Stack

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| Frontend/Full-stack framework | Next.js | 16.x | Single codebase for all 5 screens plus API routes; App Router |
| Language | TypeScript | 5.x | Type safety across service layer, API routes, assistant tools, and UI |
| Database | Postgres (Neon) | 16.x (managed) | Relational store for exhibits, event ledger, custody, rulings, jury package, assistant audit trail |
| ORM | Prisma | 5.x / 6.x | Type-safe queries over the exhibit/objection/ruling/custody graph; schema mirrors the SQL DDL in `02-data-model.md` |
| AI/Assistant SDK | Vercel AI SDK (`ai`, `@ai-sdk/react`, `@ai-sdk/anthropic`) | current (Oct 2026 dist-tags) | Tool-calling + streaming chat (`streamText`, `tool()`, `useChat`) for the Pivota Assistant |
| LLM Provider | Anthropic (via `@ai-sdk/anthropic`) | — | Server-side tool-calling model; swappable to `@ai-sdk/openai` with no architecture change (AI SDK provider abstraction) |
| Validation | zod | 3.x | Validates API request bodies, tool-call arguments, and `ExhibitEvent.payload` discriminated-union shapes before any Prisma write |
| UI components | IBM Carbon Design System (`@carbon/react`) | current | Consistent, accessible, enterprise-grade component layer across all screens (status badges, timelines, chat panel) — WCAG 2.1 AA conformant by default. **Amended Phase 8:** paired with a new dark-dashboard theme token set layered on top of this same foundation — see §6.1a. Carbon itself is unchanged/unreplaced. |
| Server-state/caching | `@tanstack/react-query` | 5.x | Polling-based live sync (3–5s refetch interval + refetch-on-focus) across Command Center, Case Workspace, Exhibit Detail, Jury Package |
| Client state | zustand | 4.x/5.x | Lightweight client state for the role switcher, case selector (added Phase 7.1, F22), and chat-panel UI state |
| PDF generation | `@react-pdf/renderer` *(added Phase 7.1, F23)* | current | Server-side, pure-JS jury-package PDF export — no headless-browser binary; see §6.4 for the full fit rationale |
| Hosting | Vercel | — | Single deployable artifact hosting UI, API routes, and the assistant route together |

### 6.1a UI Theming — Dark Dashboard Visual Foundation (Phase 8)

Phase 8's visual redesign (Command Center, Case Workspace, Exhibit Detail, Jury Package) is implemented as a **token-layer addition on top of the existing Carbon foundation established in Phase 6**, not a replacement of `@carbon/react` and not the introduction of a second component library:

| Aspect | Approach |
|---|---|
| Mechanism | A new dark Carbon theme (Carbon's `g90`/`g100` token set, or a custom token override built on Carbon's theming API) applied at the application shell level, plus component-level style overrides (spacing, card/tile treatments for the Command Center's stat cards, distribution bar, attention-feed entries, and the Jury Package Blockers/Clean card layout) scoped with Carbon's existing CSS custom-property/SCSS theming conventions |
| What is NOT happening | No fork of Carbon, no second UI kit alongside it, no CSS-in-JS library introduced, no visual-language system built from scratch — every new surface (stat cards, progress indicators, severity-tiered feed entries, Blockers/Clean cards) is composed from Carbon primitives already in the dependency tree (`Tile`, `Tag`, `ProgressBar`-equivalent composition, `Grid`) |
| New dependency required? | **No.** Carbon's existing primitives (tiles, tags, grid, button, modal) are sufficient to compose every new Phase 8 surface — confirmed during design review before this phase was scoped. See §6.4; no row is added there for theming. |
| Why layered, not forked | Keeps every Carbon accessibility guarantee (WCAG 2.1 AA conformance, established Phase 6) intact — a token/override layer inherits Carbon's accessible component internals; a fork or replacement would require re-establishing that conformance from scratch |
| Relationship to prior phases | Every screen's underlying data-fetching, polling, and service-layer contract (Phases 1–7.1) is completely unaffected — this is a rendering/styling change only, exactly as Phase 6's original Carbon migration was scoped ("zero change to underlying functionality, data behavior, API routes") |

### 6.1b Font Loading — IBM Plex via `next/font`, Not Carbon's Own Font-Face Partial (Phase 9, T-16)

**Problem found in review:** Carbon's SCSS references `IBM Plex Sans`/`IBM Plex Mono` (`$font-family`-family variables) throughout its component styles, but no `@font-face` declaration for either typeface was ever wired into the build — Carbon ships its font-face Sass partials (`@carbon/styles/scss/_font-face-sans.scss`, `_font-face-mono.scss`) as something a consuming app must explicitly `@forward`/`@use` and point at font asset files; that step was never done. The practical effect is every surface silently falls back to the browser default sans-serif, undermining the "enterprise, accessible, intentional" visual language the Carbon migration (Phase 6) and dark-dashboard theming (Phase 8, §6.1a) were adopted to deliver.

**Decision: self-host via Next.js's built-in `next/font`, not Carbon's own font-face Sass partial.**

| Aspect | Approach |
|---|---|
| Mechanism | `next/font/local` (or `next/font/google`, if the IBM Plex family is sourced from Google Fonts rather than vendored `.woff2` files directly) loads IBM Plex Sans and IBM Plex Mono once, at build time, in the application's root layout — generating a single scoped CSS custom property (e.g. `--font-ibm-plex-sans`, `--font-ibm-plex-mono`) and a single, deduplicated set of `@font-face` rules. Carbon's own `$font-family`/`$font-family-mono` SCSS variables are then overridden to reference that same generated font/CSS-variable, so every Carbon component (which already composes from `$font-family` internally) picks up the self-hosted font with no per-component change |
| Why `next/font`, not Carbon's font-face partial | (1) **Zero new dependency** — `next/font` ships inside `next` itself (already the pinned framework, §6.1), consistent with this project's standing preference to avoid adding a package where the existing framework already solves the problem (§6.5). Carbon's font-face partial introduces no new *npm* dependency either, but requires vendoring/hosting the actual `.woff2` font asset files and wiring a second, independent font-loading path alongside Next's own — more moving parts for a single-presenter demo build to keep correct, not fewer. (2) **No live-network dependency during a demo.** `next/font` self-hosts at build time regardless of source (Google or local), eliminating any runtime CDN fetch — important for a live courtroom-audience walkthrough where a flaky venue network must not visibly reflow or blank-flash body text mid-demonstration. (3) **Automatic font-display/layout-shift handling** — `next/font` computes a size-adjusted fallback and sets `font-display` sensibly by default, which Carbon's raw font-face partial does not do for you |
| **Binding constraint — fonts load exactly once** | Carbon's own font-face Sass partials (`_font-face-sans.scss`, `_font-face-mono.scss`) **must not** be imported/forwarded anywhere in the build once `next/font` is wired in. Loading both would register two independent `@font-face` declarations for the same family names, which is not merely redundant — depending on load order and `font-display` values between the two sources, it can cause visible font-swap flicker or inconsistent rendering of the *same* text run across the page. There is exactly one font-loading mechanism in this codebase (`next/font`), and Carbon's typography variables are reduced to consuming its output, not an independent second source |
| Scope of change | Styling/build-pipeline only — no component API, service-layer, or schema change. Affects the application shell's root layout and the global Carbon SCSS token overlay (§6.1a) only |

### 6.2 Data Model Pattern

| Pattern | Implementation |
|---|---|
| Append-only event ledger | `exhibit_events` table (Postgres) / `ExhibitEvent` (Prisma model) — ground-truth history for status/objection/ruling/custody changes |
| Current-state projection | `exhibit_current_state`, `objection_current_state`, `custody_current_state`, `discrepancy_flags` — derived, fast-read views recomputed synchronously on every relevant ledger write |

### 6.3 Service Layer

| Pattern | Implementation |
|---|---|
| Single typed service module | `services/*.ts` — `getExhibits`, `getCustodian`, `getUnresolvedObjections`, `recordEvent`, `computeJuryCandidates`, `evaluateDiscrepancies`, etc. — sole entry point for both UI API routes and assistant tool wrappers; no parallel retrieval path |

### 6.4 Key Dependencies (package-level detail)

| Package | Role |
|---|---|
| `next` | Full-stack framework (App Router, API routes, server components where applicable) |
| `react`, `react-dom` | UI runtime (React 19.x, bundled with Next.js 16) |
| `typescript` | Static typing across the entire codebase |
| `@prisma/client`, `prisma` (CLI) | Generated type-safe DB client + migration tooling |
| `ai` | Vercel AI SDK core (`streamText`, `tool()`, provider-agnostic primitives) |
| `@ai-sdk/react` | `useChat` hook powering the streaming chat panel |
| `@ai-sdk/anthropic` | Anthropic provider adapter for the AI SDK |
| `zod` | Schema validation for API payloads, tool-call arguments, and ledger event payloads |
| `@tanstack/react-query` | Query caching + polling-based live sync |
| `zustand` | Role-switcher state + lightweight UI state |
| `@carbon/react`, `@carbon/styles`, `@carbon/icons-react` | Carbon component library, design tokens/SCSS theming, and icon set |
| `@neondatabase/serverless` (optional, if using Neon's HTTP/WebSocket driver) | Serverless-friendly Postgres connectivity from Vercel's runtime, as an alternative/complement to a standard pooled TCP connection via Prisma |
| `@react-pdf/renderer` *(added Phase 7.1, F23 — first new runtime dependency since initial stack lock-in)* | Server-side PDF generation for finalized jury package export (`services/juryPackage.ts#exportJuryPackagePdf`, `lib/pdf/JuryPackageDocument.tsx`). Selected because it generates PDFs from JSX/React-component definitions (`<Document>`/`<Page>`/`<View>`/`<Text>`) in pure JavaScript, with **no headless-browser binary** required — unlike a Puppeteer/Playwright-based HTML-to-PDF approach, which would require bundling and cold-starting a full Chromium binary per Vercel serverless invocation. Its component-based API also fits this React/Next.js codebase's idioms natively, rather than introducing an unrelated templating system. **Every other Phase 7.1 feature (F16–F22) introduces no new dependency** — this is flagged explicitly because it is the sole exception. **Phase 8 introduces no new dependency either** (F08, F09, F10, F11, F24, and the dark-dashboard theming all compose existing `@carbon/react`/`@tanstack/react-query`/`zustand` primitives — see §6.1a). **Phase 9 introduces no new dependency either** — the 16-ticket UI/typography hardening pass (F01, F08–F11, F20, F24, F25) is entirely component/token-layer work plus a font-loading fix built on `next/font`, which ships inside the already-pinned `next` package itself (see §6.1b); `@react-pdf/renderer` remains the only new runtime dependency added since initial stack lock-in. |

### 6.5 Explicitly Avoided Dependencies

Per PRD §4 and research findings — any reintroduction of these should be treated as a scope/architecture change requiring re-justification, not an incremental addition:

| Avoided | Reason |
|---|---|
| Vector database (Pinecone, pgvector, Weaviate, etc.) | Data is structured and small, not a document corpus requiring semantic/approximate search |
| Embeddings pipeline | Same as above — would introduce approximation where exact citation is required |
| LangChain / LangGraph / agent-framework abstraction | Unnecessary abstraction over a fixed, small (≤8) tool set already well-served by the AI SDK's native `tool()` |
| NextAuth / OAuth provider / SSO | Production auth hardening explicitly out of scope for a demo (seeded users + role switcher instead) |
| Message queue (SQS, BullMQ, etc.) | All writes are synchronous request/response cycles at demo scale — no async job processing is needed |
| Redis / caching layer | No read bottleneck expected at demo scale (dozens–hundreds of exhibits, single case, <10 concurrent users) |
| WebSocket/SSE infrastructure | Polling (3–5s) is sufficient for the live multi-screen sync requirement; deferred unless demo rehearsal proves it insufficient |

### 6.6 Development & Build Tooling

| Tool | Purpose |
|---|---|
| Prisma Migrate | Schema migrations against Neon (dev branch + production branch) |
| `tsx` / `ts-node` (dev) | Running the deterministic seed-data loader (`data/seed.ts`) |
| ESLint + TypeScript compiler | Static checks; Next.js's built-in ESLint config as a baseline |
| Vercel CLI / Git-integrated deploys | Single-command deploy of the full-stack artifact |
