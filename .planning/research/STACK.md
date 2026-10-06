# Stack Research

**Domain:** Demo-grade courtroom exhibit-tracking web app with embedded NL assistant ("copilot" pattern)
**Researched:** 2026-10-06
**Confidence:** HIGH (versions verified against npm registry + Next.js/AI SDK official docs, Oct 2026)

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Next.js (App Router) | 16.4.0 | Full-stack React framework | One codebase for the 4 demo screens + API/Server Actions; current stable as of Oct 2026, fast dev loop (Turbopack default) suits a tight demo timeline |
| TypeScript | 5.x | Type safety end-to-end | Shared types across exhibit schema, UI, and assistant tool-call args catch data-model mismatches before a live demo |
| PostgreSQL (via Neon) | 16/17 | Relational store for exhibits/objections/rulings/custody | Entity relationships (exhibit→objection→ruling→custody chain) are inherently relational; Neon = zero-ops serverless Postgres that pairs natively with Vercel |
| Prisma | 7.10.0 (`prisma` + `@prisma/client`) | ORM, migrations, seeding | Type-safe queries the assistant's tool functions call directly; Prisma Studio speeds up building realistic seed data for the demo scenario |
| AI SDK (Vercel) | `ai@7.0.129`, `@ai-sdk/react@4.0.132` | LLM integration, streaming chat UI, tool calling | The standard 2026 toolkit for the "copilot" pattern: `useChat` + `streamText` + typed `tool()` — built for exactly this chat-over-app-data shape |
| `@ai-sdk/anthropic` or `@ai-sdk/openai` | 4.0.x | LLM provider | AI SDK's provider abstraction lets you swap models without touching app code; Claude favored for grounded, citation-style answers over legal/procedural text |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod | 4.6.x | Schema validation | Validate assistant tool-call args (e.g. `getExhibit(id)`) and API payloads before they hit Prisma |
| shadcn/ui (`shadcn` CLI) + Tailwind CSS | 4.21.x / 4.3.x | UI primitives + styling | Fast, accessible, professional-looking components for Command Center / Case Workspace / Exhibit Detail / Jury Package screens without custom CSS |
| @tanstack/react-query | 5.104.x | Client data fetching/cache | Keeps non-chat "live" views (Trial Command Center) in sync without hand-rolled polling |
| zustand | 5.0.x | Lightweight client state | Selected exhibit/case, assistant panel open state — simpler than Redux at demo scope |
| date-fns | latest 3.x/4.x | Timestamp formatting | Consistent, readable formatting for ruling/custody timestamps across screens |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Vitest | Unit tests for tool-calling functions & data layer | Fast, native ESM, pairs well with Next.js 16 |
| Playwright | E2E test of the "ask → answer" demo flow | Script the exact judge-asks-a-question scenario as a regression test |
| Prisma Studio | Inspect/edit seed data during dev | Bundled with `prisma` — no extra install |
| ESLint + Prettier | Code consistency | Use Next.js's built-in ESLint config as base |

## Installation

```bash
# Core
npm install next@16.4.0 react@latest react-dom@latest typescript
npm install @prisma/client ai @ai-sdk/react @ai-sdk/anthropic zod

# Supporting
npm install @tanstack/react-query zustand date-fns tailwindcss
npx shadcn@latest init

# Dev dependencies
npm install -D prisma vitest @playwright/test eslint prettier
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Prisma | Drizzle ORM | Prefer Drizzle if the team wants closer-to-SQL control; Prisma's Studio + migration DX wins for fast demo-data iteration |
| Neon Postgres | SQLite (`better-sqlite3`) | Use SQLite if the demo must run fully offline in a courtroom with no network dependency |
| Vercel AI SDK | LangChain.js | Only if you need complex multi-step agent orchestration; for a chat-over-structured-data copilot, AI SDK's `tool()` + `streamText` is thinner and more current |
| Claude via AI SDK | OpenAI via AI SDK | Swap based on contract/API-key availability at demo time — same abstraction, no architecture change |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Vector DB / embeddings (pgvector, Pinecone) | Exhibit/custody/ruling data is small and structured, not a document corpus — semantic search invites hallucinated matches on precise legal facts | Direct tool-calling against Prisma queries (exact ID/status lookups) |
| `shadcn-ui` (old npm package name) | Deprecated, pulls stale Radix/Tailwind versions | `shadcn` CLI (current name, 4.21.x) |
| Full OAuth (NextAuth/Auth.js with real providers) | PROJECT.md scopes auth to "basic role distinction," not production security | Seeded users table + simple session cookie / role switcher |
| LangChain/LlamaIndex agent frameworks | Heavy abstraction, slower to debug under a demo deadline for a single-tool-calling use case | AI SDK's native `tool()` + `streamText` |

## Stack Patterns by Variant

**If the demo must run fully offline during a live courtroom walkthrough (no network):**
- Use SQLite via `better-sqlite3` + Prisma's sqlite provider instead of Neon Postgres
- Because a live demo cannot depend on cloud DB latency or connectivity

**If the recorded/live demo needs guaranteed-consistent assistant answers (not live-generated every take):**
- Pre-script and cache responses with `generateText` at build/seed time instead of `streamText` per request
- Because it removes live LLM latency and cost/availability risk during a client-facing recording

**If the assistant must cite sources (PROJECT.md requires "supporting context/citations" on every answer):**
- Feed `tool()` query results back into the model's response so cited exhibit/ruling IDs are the actual DB rows returned, not free-generated text
- Because ungrounded citations are the single fastest way to destroy courtroom-staff trust in the demo

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| next@16.4.0 | react@19.2+, react-dom@19.2+ | Bundled automatically via `create-next-app`; do not pin React 18 |
| prisma@7.10.0 | @prisma/client@7.10.0 | CLI and client major/minor versions must match exactly |
| ai@7.0.129 | @ai-sdk/react@4.0.132, @ai-sdk/openai@4.0.85, @ai-sdk/anthropic@4.0.x | Provider packages use independent 4.x versioning but are release-coordinated with `ai`@7; install latest of each together, don't mix with `ai`@5/6 lines |
| zod@4.6.x | @ai-sdk/* peer range `^3.25.76 \|\| ^4.1.8` | Zod 4.6 satisfies the AI SDK provider peer range |

## Sources

- https://nextjs.org/blog — confirmed Next.js 16.4.0 current stable (Oct 6, 2026), React 19.3 bundled (HIGH)
- https://ai-sdk.dev/docs/introduction — confirmed AI SDK Core/UI tool-calling + streaming architecture (HIGH)
- npm registry (`registry.npmjs.org`) — verified latest/dist-tags for next, ai, @ai-sdk/*, prisma, drizzle-orm, shadcn, tailwindcss, zustand, @tanstack/react-query, zod (HIGH)
- Training knowledge — Neon/Vercel Postgres pairing, LangChain vs AI SDK tradeoff, tool-calling-over-vector-search for structured data (MEDIUM, not independently re-verified this session)

---
*Stack research for: Courtroom exhibit tracking demo + NL assistant*
*Researched: 2026-10-06*
