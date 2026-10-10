---
phase: 09
gate_status: passed
build_command: "npm run build"
test_command: "npm test"
last_updated: 2026-10-10T19:17:27Z
tests_disabled_during_fixes: none
shadowed_sources: 0
waves:
  - wave: 1
    build: pass
    tests: pass
    fix_attempts: 0
  - wave: 2
    build: pass
    tests: pass
    fix_attempts: 1
  - wave: 3
    build: pass
    tests: pass
    fix_attempts: 0
  - wave: 4
    build: pass
    tests: pass
    fix_attempts: 0
---

## Wave 1

- Build: `npm run build` → pass
- Tests: `npm test` → pass
- Fix attempts: 0/3

### Gate output

```
> judicialsync@0.1.0 build
> next build

▲ Next.js 16.4.0 (Turbopack)
- Environments: .env
✓ Running next.config.ts took 11ms
Attention: Next.js now collects completely anonymous telemetry regarding usage.
This information is used to shape Next.js' roadmap and prioritize features.
You can learn more, including how to opt-out if you'd not like to participate in this anonymous program, by visiting the following URL:
https://nextjs.org/telemetry


  Creating an optimized production build ...
✓ Compiled successfully in 6.3s
  Running TypeScript ...
  Finished TypeScript in 1730ms ...
  Collecting page data using 1 worker ...
  Generating static pages using 1 worker (0/10) ...
  Generating static pages using 1 worker (2/10) 
[@carbon/feature-flags] `enable-v12-tile-default-icons` is available but not enabled.
Enable rendering of default icons in the tile components
This becomes the default behavior in v12. Enable it to migrate early, or enable `enable-v12-release` to turn on every v12 flag at once.
  Generating static pages using 1 worker (4/10) 
  Generating static pages using 1 worker (7/10) 
✓ Generating static pages using 1 worker (10/10) in 193ms
  Finalizing page optimization ...

Route (app)
┌ ○ /
├ ○ /_not-found
├ ƒ /api/assistant/chat
├ ƒ /api/assistant/conversations/[id]
├ ƒ /api/case
├ ƒ /api/cases/[id]/activity
├ ƒ /api/cases/[id]/attention-feed
├ ƒ /api/cases/[id]/custody-by-custodian
├ ƒ /api/cases/[id]/discrepancies
├ ƒ /api/cases/[id]/exhibits
├ ƒ /api/cases/[id]/exhibits/search
├ ƒ /api/cases/[id]/jury-package
├ ƒ /api/cases/[id]/jury-package/preview
├ ƒ /api/cases/[id]/objections
├ ƒ /api/discrepancies/[id]/acknowledge
├ ƒ /api/exhibits
├ ƒ /api/exhibits/[id]
├ ƒ /api/exhibits/[id]/custodian
├ ƒ /api/exhibits/[id]/custody-history
├ ƒ /api/exhibits/[id]/discrepancies
├ ƒ /api/exhibits/[id]/events/custody
├ ƒ /api/exhibits/[id]/events/objection
├ ƒ /api/exhibits/[id]/events/status
├ ƒ /api/exhibits/[id]/history
├ ƒ /api/exhibits/[id]/status
├ ƒ /api/jury-package/[id]/exhibits/[exhibitId]/exclude
├ ƒ /api/jury-package/[id]/finalize
├ ƒ /api/jury-package/[id]/request-finalization
├ ƒ /api/objections/[id]/ruling
├ ○ /assistant
├ ○ /case
├ ○ /command-center
├ ƒ /exhibit/[id]
└ ○ /jury-package


○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand


> judicialsync@0.1.0 test
> vitest run


[1m[46m RUN [49m[22m [36mv3.2.7 [39m[90m/home/daytona/project[39m

 [32m✓[39m src/services/juryPackage.test.ts [2m([22m[2m22 tests[22m[2m)[22m[33m 427[2mms[22m[39m
 [32m✓[39m src/app/api/assistant/chat/route.test.ts [2m([22m[2m19 tests[22m[2m | [22m[33m3 skipped[39m[2m)[22m[33m 64762[2mms[22m[39m
   [33m[2m✓[22m[39m POST /api/assistant/chat[2m > [22mgrounded-or-decline behavior (real ANTHROPIC_API_KEY present)[2m > [22mresolves "what exhibits were admitted yesterday" as grounded (>=1 real citation) OR a zero-citation Decline — never ungrounded [33m 6901[2mms[22m[39m
   [33m[2m✓[22m[39m POST /api/assistant/chat[2m > [22mgrounded-or-decline behavior (real ANTHROPIC_API_KEY present)[2m > [22mresolves "what objections remain unresolved" as grounded (>=1 real citation) OR a zero-citation Decline — never ungrounded [33m 5129[2mms[22m[39m
   [33m[2m✓[22m[39m POST /api/assistant/chat[2m > [22mgrounded-or-decline behavior (real ANTHROPIC_API_KEY present)[2m > [22mresolves "is P-4 in the jury package" as grounded (>=1 real citation) OR a zero-citation Decline — never ungrounded [33m 3659[2mms[22m[39m
   [33m[2m✓[22m[39m POST /api/assistant/chat[2m > [22mgrounded-or-decline behavior (real ANTHROPIC_API_KEY present)[2m > [22mresolves "who currently has custody of P-4" as grounded (>=1 real citation) OR a zero-citation Decline — never ungrounded [33m 2852[2mms[22m[39m
   [33m[2m✓[22m[39m POST /api/assistant/chat[2m > [22mgrounded-or-decline behavior (real ANTHROPIC_API_KEY present)[2m > [22mresolves "what happened to P-3" as grounded (>=1 real citation) OR a zero-citation Decline — never ungrounded [33m 7720[2mms[22m[39m
   [33m[2m✓[22m[39m POST /api/assistant/chat[2m > [22mgrounded-or-decline behavior (real ANTHROPIC_API_KEY present)[2m > [22m"what exhibits were admitted yesterday" carries >=1 pill when grounded (searchExhibits path) [33m 6599[2mms[22m[39m
   [33m[2m✓[22m[39m POST /api/assistant/chat[2m > [22mgrounded-or-decline behavior (real ANTHROPIC_API_KEY present)[2m > [22m04-UAT.md test 7 repro: a decline on "what exhibits were admitted yesterday" ALWAYS carries citations: [] even though searchExhibits returned rows this turn [33m 6412[2mms[22m[39m
   [33m[2m✓[22m[39m POST /api/assistant/chat[2m > [22mgrounded-or-decline behavior (real ANTHROPIC_API_KEY present)[2m > [22mno-over-correction guard: a genuinely grounded answer ("who currently has custody of P-4") still carries >=1 citation [33m 3065[2mms[22m[39m
   [33m[2m✓[22m[39m POST /api/assistant/chat[2m > [22mgrounded-or-decline behavior (real ANTHROPIC_API_KEY present)[2m > [22msealed DEPUTY probe Declines indistinguishably from not-found (criterion 4) [33m 2411[2mms[22m[39m
   [33m[2m✓[22m[39m POST /api/assistant/chat[2m > [22mgrounded-or-decline behavior (real ANTHROPIC_API_KEY present)[2m > [22memits the data-citations frame on the live stream (writer-merge-then-write timing) — W3 [33m 6613[2mms[22m[39m
 [32m✓[39m src/services/exhibits.test.ts [2m([22m[2m29 tests[22m[2m)[22m[32m 126[2mms[22m[39m
 [32m✓[39m src/services/history.test.ts [2m([22m[2m15 tests[22m[2m)[22m[33m 13539[2mms[22m[39m
 [32m✓[39m src/services/discrepancies.test.ts [2m([22m[2m11 tests[22m[2m)[22m[32m 153[2mms[22m[39m
 [32m✓[39m src/lib/assistant/tools.test.ts [2m([22m[2m8 tests[22m[2m)[22m[33m 13432[2mms[22m[39m
 [32m✓[39m src/data/seed.test.ts [2m([22m[2m8 tests[22m[2m)[22m[33m 106915[2mms[22m[39m
   [33m[2m✓[22m[39m seed loader (F0a)[2m > [22mproduces all three planted edge cases on first run [33m 13396[2mms[22m[39m
   [33m[2m✓[22m[39m seed loader (F0a)[2m > [22mblocks admission of the planted single-reason and dual-reason fixtures (F12 demo-blocking guarantee) [33m 13369[2mms[22m[39m
   [33m[2m✓[22m[39m seed loader (F0a)[2m > [22mplants exactly one sealed exhibit (S-1) as Phase 2 role-based-visibility fixture [33m 13376[2mms[22m[39m
   [33m[2m✓[22m[39m seed loader (F0a)[2m > [22massertSeedIntegrity rejects a seed with zero sealed exhibits [33m 26699[2mms[22m[39m
   [33m[2m✓[22m[39m seed loader (F0a)[2m > [22mis deterministic across a clean-state re-run: identical count, same edge cases, no duplicate case [33m 26716[2mms[22m[39m
   [33m[2m✓[22m[39m seed loader (F0a)[2m > [22mplants P-6/P-7 as ADMITTED legacy fixtures firing their F6 rules through the live engine [33m 13354[2mms[22m[39m
 [32m✓[39m src/services/activity.test.ts [2m([22m[2m9 tests[22m[2m)[22m[32m 103[2mms[22m[39m
 [32m✓[39m src/app/api/objections/[id]/ruling/route.test.ts [2m([22m[2m10 tests[22m[2m)[22m[32m 106[2mms[22m[39m
 [32m✓[39m src/services/custody.test.ts [2m([22m[2m10 tests[22m[2m)[22m[32m 75[2mms[22m[39m
 [32m✓[39m src/services/attentionFeed.test.ts [2m([22m[2m5 tests[22m[2m)[22m[32m 93[2mms[22m[39m
 [32m✓[39m src/services/objections.test.ts [2m([22m[2m8 tests[22m[2m)[22m[32m 90[2mms[22m[39m
 [32m✓[39m src/services/admissionGate.test.ts [2m([22m[2m7 tests[22m[2m)[22m[32m 116[2mms[22m[39m
 [32m✓[39m src/services/assistant.test.ts [2m([22m[2m3 tests[22m[2m)[22m[33m 13416[2mms[22m[39m
 [32m✓[39m src/app/api/exhibits/[id]/events/status/route.test.ts [2m([22m[2m8 tests[22m[2m)[22m[32m 89[2mms[22m[39m
 [32m✓[39m src/app/api/exhibits/[id]/events/custody/route.test.ts [2m([22m[2m7 tests[22m[2m)[22m[32m 70[2mms[22m[39m
 [32m✓[39m src/app/api/discrepancies/[id]/acknowledge/route.test.ts [2m([22m[2m9 tests[22m[2m)[22m[32m 232[2mms[22m[39m
 [32m✓[39m src/app/api/cases/[id]/jury-package/route.test.ts [2m([22m[2m5 tests[22m[2m)[22m[32m 185[2mms[22m[39m
 [32m✓[39m src/app/api/jury-package/[id]/exhibits/[exhibitId]/exclude/route.test.ts [2m([22m[2m6 tests[22m[2m)[22m[32m 121[2mms[22m[39m
 [32m✓[39m src/app/api/jury-package/[id]/request-finalization/route.test.ts [2m([22m[2m4 tests[22m[2m)[22m[32m 149[2mms[22m[39m
 [32m✓[39m src/services/custodyByCustodian.test.ts [2m([22m[2m2 tests[22m[2m)[22m[32m 61[2mms[22m[39m
 [32m✓[39m src/app/api/jury-package/[id]/finalize/route.test.ts [2m([22m[2m3 tests[22m[2m)[22m[32m 125[2mms[22m[39m
 [32m✓[39m src/services/status.test.ts [2m([22m[2m4 tests[22m[2m)[22m[32m 67[2mms[22m[39m
 [32m✓[39m src/app/api/cases/[id]/activity/route.test.ts [2m([22m[2m5 tests[22m[2m)[22m[32m 49[2mms[22m[39m
 [32m✓[39m src/app/api/cases/[id]/exhibits/search/route.test.ts [2m([22m[2m8 tests[22m[2m)[22m[32m 46[2mms[22m[39m
 [32m✓[39m src/lib/assistant/schema.test.ts [2m([22m[2m4 tests[22m[2m)[22m[33m 13402[2mms[22m[39m
 [32m✓[39m src/app/api/cases/[id]/exhibits/route.test.ts [2m([22m[2m5 tests[22m[2m)[22m[32m 51[2mms[22m[39m
 [32m✓[39m src/app/api/exhibits/[id]/history/route.test.ts [2m([22m[2m4 tests[22m[2m)[22m[32m 43[2mms[22m[39m
 [32m✓[39m src/app/api/cases/[id]/custody-by-custodian/route.test.ts [2m([22m[2m2 tests[22m[2m)[22m[32m 43[2mms[22m[39m
 [32m✓[39m src/app/api/cases/[id]/discrepancies/route.test.ts [2m([22m[2m2 tests[22m[2m)[22m[32m 58[2mms[22m[39m
 [32m✓[39m src/services/rebuild.test.ts [2m([22m[2m3 tests[22m[2m)[22m[33m 26777[2mms[22m[39m
 [32m✓[39m src/app/api/exhibits/route.test.ts [2m([22m[2m4 tests[22m[2m)[22m[32m 43[2mms[22m[39m
 [32m✓[39m src/app/api/cases/[id]/attention-feed/route.test.ts [2m([22m[2m2 tests[22m[2m)[22m[32m 41[2mms[22m[39m
 [32m✓[39m src/app/api/exhibits/[id]/route.test.ts [2m([22m[2m4 tests[22m[2m)[22m[32m 33[2mms[22m[39m
 [32m✓[39m src/app/api/case/route.test.ts [2m([22m[2m2 tests[22m[2m)[22m[33m 26772[2mms[22m[39m
 [32m✓[39m src/services/events.test.ts [2m([22m[2m2 tests[22m[2m)[22m[32m 32[2mms[22m[39m
 [32m✓[39m src/components/shared/SeverityPill.test.ts [2m([22m[2m6 tests[22m[2m)[22m[32m 2[2mms[22m[39m
 [32m✓[39m src/components/shared/TwoColorProgressBar.test.ts [2m([22m[2m6 tests[22m[2m)[22m[32m 2[2mms[22m[39m
 [32m✓[39m src/services/visibility.test.ts [2m([22m[2m6 tests[22m[2m)[22m[32m 4[2mms[22m[39m
 [32m✓[39m src/services/cases.test.ts [2m([22m[2m2 tests[22m[2m)[22m[33m 13407[2mms[22m[39m
 [32m✓[39m tests/boot.test.ts [2m([22m[2m3 tests[22m[2m)[22m[32m 43[2mms[22m[39m

[2m Test Files [22m [1m[32m41 passed[39m[22m[90m (41)[39m
[2m      Tests [22m [1m[32m279 passed[39m[22m[2m | [22m[33m3 skipped[39m[90m (282)[39m
[2m   Start at [22m 18:06:47
[2m   Duration [22m 300.09s[2m (transform 411ms, setup 0ms, collect 1.99s, tests 295.30s, environment 3ms, prepare 1.01s)[22m
```

## Wave 2

- Build: `npm run build` → pass
- Tests: `npm test` → pass
- Fix attempts: 1/3 — P-3 search-route eligibility assertion updated to 09-06 4-value precedence (NOT_YET_EVALUATED) → commit 40f06b7

### Gate output

```
> judicialsync@0.1.0 test
> vitest run


[1m[46m RUN [49m[22m [36mv3.2.7 [39m[90m/home/daytona/project[39m

 [32m✓[39m src/data/seed.test.ts [2m([22m[2m8 tests[22m[2m)[22m[33m 106857[2mms[22m[39m
   [33m[2m✓[22m[39m seed loader (F0a)[2m > [22mproduces all three planted edge cases on first run [33m 13403[2mms[22m[39m
   [33m[2m✓[22m[39m seed loader (F0a)[2m > [22mblocks admission of the planted single-reason and dual-reason fixtures (F12 demo-blocking guarantee) [33m 13365[2mms[22m[39m
   [33m[2m✓[22m[39m seed loader (F0a)[2m > [22mplants exactly one sealed exhibit (S-1) as Phase 2 role-based-visibility fixture [33m 13356[2mms[22m[39m
   [33m[2m✓[22m[39m seed loader (F0a)[2m > [22massertSeedIntegrity rejects a seed with zero sealed exhibits [33m 26696[2mms[22m[39m
   [33m[2m✓[22m[39m seed loader (F0a)[2m > [22mis deterministic across a clean-state re-run: identical count, same edge cases, no duplicate case [33m 26690[2mms[22m[39m
   [33m[2m✓[22m[39m seed loader (F0a)[2m > [22mplants P-6/P-7 as ADMITTED legacy fixtures firing their F6 rules through the live engine [33m 13341[2mms[22m[39m
 [32m✓[39m src/app/api/assistant/chat/route.test.ts [2m([22m[2m19 tests[22m[2m | [22m[33m3 skipped[39m[2m)[22m[33m 52410[2mms[22m[39m
   [33m[2m✓[22m[39m POST /api/assistant/chat[2m > [22mgrounded-or-decline behavior (real ANTHROPIC_API_KEY present)[2m > [22mresolves "what exhibits were admitted yesterday" as grounded (>=1 real citation) OR a zero-citation Decline — never ungrounded [33m 3728[2mms[22m[39m
   [33m[2m✓[22m[39m POST /api/assistant/chat[2m > [22mgrounded-or-decline behavior (real ANTHROPIC_API_KEY present)[2m > [22mresolves "what objections remain unresolved" as grounded (>=1 real citation) OR a zero-citation Decline — never ungrounded [33m 5357[2mms[22m[39m
   [33m[2m✓[22m[39m POST /api/assistant/chat[2m > [22mgrounded-or-decline behavior (real ANTHROPIC_API_KEY present)[2m > [22mresolves "is P-4 in the jury package" as grounded (>=1 real citation) OR a zero-citation Decline — never ungrounded [33m 3733[2mms[22m[39m
   [33m[2m✓[22m[39m POST /api/assistant/chat[2m > [22mgrounded-or-decline behavior (real ANTHROPIC_API_KEY present)[2m > [22mresolves "who currently has custody of P-4" as grounded (>=1 real citation) OR a zero-citation Decline — never ungrounded [33m 2926[2mms[22m[39m
   [33m[2m✓[22m[39m POST /api/assistant/chat[2m > [22mgrounded-or-decline behavior (real ANTHROPIC_API_KEY present)[2m > [22mresolves "what happened to P-3" as grounded (>=1 real citation) OR a zero-citation Decline — never ungrounded [33m 7011[2mms[22m[39m
   [33m[2m✓[22m[39m POST /api/assistant/chat[2m > [22mgrounded-or-decline behavior (real ANTHROPIC_API_KEY present)[2m > [22m"what exhibits were admitted yesterday" carries >=1 pill when grounded (searchExhibits path) [33m 3822[2mms[22m[39m
   [33m[2m✓[22m[39m POST /api/assistant/chat[2m > [22mgrounded-or-decline behavior (real ANTHROPIC_API_KEY present)[2m > [22m04-UAT.md test 7 repro: a decline on "what exhibits were admitted yesterday" ALWAYS carries citations: [] even though searchExhibits returned rows this turn [33m 3711[2mms[22m[39m
   [33m[2m✓[22m[39m POST /api/assistant/chat[2m > [22mgrounded-or-decline behavior (real ANTHROPIC_API_KEY present)[2m > [22mno-over-correction guard: a genuinely grounded answer ("who currently has custody of P-4") still carries >=1 citation [33m 3030[2mms[22m[39m
   [33m[2m✓[22m[39m POST /api/assistant/chat[2m > [22mgrounded-or-decline behavior (real ANTHROPIC_API_KEY present)[2m > [22msealed DEPUTY probe Declines indistinguishably from not-found (criterion 4) [33m 2301[2mms[22m[39m
   [33m[2m✓[22m[39m POST /api/assistant/chat[2m > [22mgrounded-or-decline behavior (real ANTHROPIC_API_KEY present)[2m > [22memits the data-citations frame on the live stream (writer-merge-then-write timing) — W3 [33m 3378[2mms[22m[39m
 [32m✓[39m src/services/rebuild.test.ts [2m([22m[2m3 tests[22m[2m)[22m[33m 26807[2mms[22m[39m
 [32m✓[39m src/app/api/case/route.test.ts [2m([22m[2m2 tests[22m[2m)[22m[33m 26773[2mms[22m[39m
 [32m✓[39m src/services/history.test.ts [2m([22m[2m15 tests[22m[2m)[22m[33m 13545[2mms[22m[39m
 [32m✓[39m src/lib/assistant/tools.test.ts [2m([22m[2m8 tests[22m[2m)[22m[33m 13427[2mms[22m[39m
 [32m✓[39m src/services/assistant.test.ts [2m([22m[2m3 tests[22m[2m)[22m[33m 13403[2mms[22m[39m
 [32m✓[39m src/lib/assistant/schema.test.ts [2m([22m[2m4 tests[22m[2m)[22m[33m 13389[2mms[22m[39m
 [32m✓[39m src/services/cases.test.ts [2m([22m[2m2 tests[22m[2m)[22m[33m 13406[2mms[22m[39m
 [32m✓[39m src/services/juryPackage.test.ts [2m([22m[2m22 tests[22m[2m)[22m[33m 416[2mms[22m[39m
 [32m✓[39m src/app/api/discrepancies/[id]/acknowledge/route.test.ts [2m([22m[2m9 tests[22m[2m)[22m[32m 233[2mms[22m[39m
 [32m✓[39m src/services/discrepancies.test.ts [2m([22m[2m11 tests[22m[2m)[22m[32m 161[2mms[22m[39m
 [32m✓[39m src/app/api/cases/[id]/jury-package/route.test.ts [2m([22m[2m5 tests[22m[2m)[22m[32m 175[2mms[22m[39m
 [32m✓[39m src/app/api/jury-package/[id]/request-finalization/route.test.ts [2m([22m[2m4 tests[22m[2m)[22m[32m 139[2mms[22m[39m
 [32m✓[39m src/services/exhibits.test.ts [2m([22m[2m32 tests[22m[2m)[22m[32m 136[2mms[22m[39m
 [32m✓[39m src/app/api/jury-package/[id]/finalize/route.test.ts [2m([22m[2m3 tests[22m[2m)[22m[32m 127[2mms[22m[39m
 [32m✓[39m src/services/admissionGate.test.ts [2m([22m[2m7 tests[22m[2m)[22m[32m 115[2mms[22m[39m
 [32m✓[39m src/app/api/jury-package/[id]/exhibits/[exhibitId]/exclude/route.test.ts [2m([22m[2m6 tests[22m[2m)[22m[32m 111[2mms[22m[39m
 [32m✓[39m src/app/api/objections/[id]/ruling/route.test.ts [2m([22m[2m10 tests[22m[2m)[22m[32m 102[2mms[22m[39m
 [32m✓[39m src/services/activity.test.ts [2m([22m[2m9 tests[22m[2m)[22m[32m 105[2mms[22m[39m
 [32m✓[39m src/services/attentionFeed.test.ts [2m([22m[2m5 tests[22m[2m)[22m[32m 96[2mms[22m[39m
 [32m✓[39m src/app/api/exhibits/[id]/events/status/route.test.ts [2m([22m[2m8 tests[22m[2m)[22m[32m 82[2mms[22m[39m
 [32m✓[39m src/services/custody.test.ts [2m([22m[2m10 tests[22m[2m)[22m[32m 79[2mms[22m[39m
 [32m✓[39m src/services/objections.test.ts [2m([22m[2m8 tests[22m[2m)[22m[32m 83[2mms[22m[39m
 [32m✓[39m src/services/status.test.ts [2m([22m[2m4 tests[22m[2m)[22m[32m 68[2mms[22m[39m
 [32m✓[39m src/app/api/exhibits/[id]/events/custody/route.test.ts [2m([22m[2m7 tests[22m[2m)[22m[32m 58[2mms[22m[39m
 [32m✓[39m src/app/api/cases/[id]/discrepancies/route.test.ts [2m([22m[2m2 tests[22m[2m)[22m[32m 63[2mms[22m[39m
 [32m✓[39m src/services/custodyByCustodian.test.ts [2m([22m[2m2 tests[22m[2m)[22m[32m 57[2mms[22m[39m
 [32m✓[39m src/app/api/cases/[id]/activity/route.test.ts [2m([22m[2m5 tests[22m[2m)[22m[32m 51[2mms[22m[39m
 [32m✓[39m src/app/api/cases/[id]/exhibits/route.test.ts [2m([22m[2m5 tests[22m[2m)[22m[32m 54[2mms[22m[39m
 [32m✓[39m src/app/api/cases/[id]/exhibits/search/route.test.ts [2m([22m[2m8 tests[22m[2m)[22m[32m 50[2mms[22m[39m
 [32m✓[39m tests/boot.test.ts [2m([22m[2m3 tests[22m[2m)[22m[32m 55[2mms[22m[39m
 [32m✓[39m src/app/api/exhibits/[id]/history/route.test.ts [2m([22m[2m4 tests[22m[2m)[22m[32m 44[2mms[22m[39m
 [32m✓[39m src/app/api/exhibits/route.test.ts [2m([22m[2m4 tests[22m[2m)[22m[32m 43[2mms[22m[39m
 [32m✓[39m src/app/api/cases/[id]/custody-by-custodian/route.test.ts [2m([22m[2m2 tests[22m[2m)[22m[32m 45[2mms[22m[39m
 [32m✓[39m src/app/api/cases/[id]/attention-feed/route.test.ts [2m([22m[2m2 tests[22m[2m)[22m[32m 41[2mms[22m[39m
 [32m✓[39m src/services/events.test.ts [2m([22m[2m2 tests[22m[2m)[22m[32m 37[2mms[22m[39m
 [32m✓[39m src/app/api/exhibits/[id]/route.test.ts [2m([22m[2m4 tests[22m[2m)[22m[32m 31[2mms[22m[39m
 [32m✓[39m src/services/visibility.test.ts [2m([22m[2m6 tests[22m[2m)[22m[32m 4[2mms[22m[39m
 [32m✓[39m src/components/shared/TwoColorProgressBar.test.ts [2m([22m[2m6 tests[22m[2m)[22m[32m 2[2mms[22m[39m
 [32m✓[39m src/components/shared/SeverityPill.test.ts [2m([22m[2m6 tests[22m[2m)[22m[32m 1[2mms[22m[39m

[2m Test Files [22m [1m[32m41 passed[39m[22m[90m (41)[39m
[2m      Tests [22m [1m[32m282 passed[39m[22m[2m | [22m[33m3 skipped[39m[90m (285)[39m
[2m   Start at [22m 18:42:37
[2m   Duration [22m 287.59s[2m (transform 386ms, setup 0ms, collect 1.93s, tests 282.88s, environment 3ms, prepare 1.00s)[22m
```

## Wave 3

- Build: `npm run build` → pass
- Tests: `npm test` → pass
- Fix attempts: 0/3

### Gate output

```
> judicialsync@0.1.0 build
> next build

▲ Next.js 16.4.0 (Turbopack)
- Environments: .env
✓ Running next.config.ts took 12ms

  Creating an optimized production build ...
✓ Compiled successfully in 6.6s
  Running TypeScript ...
  Finished TypeScript in 1567ms ...
  Collecting page data using 1 worker ...
  Generating static pages using 1 worker (0/11) ...
  Generating static pages using 1 worker (2/11) 
  Generating static pages using 1 worker (5/11) 
  Generating static pages using 1 worker (8/11) 
[@carbon/feature-flags] `enable-v12-tile-default-icons` is available but not enabled.
Enable rendering of default icons in the tile components
This becomes the default behavior in v12. Enable it to migrate early, or enable `enable-v12-release` to turn on every v12 flag at once.
✓ Generating static pages using 1 worker (11/11) in 205ms
  Finalizing page optimization ...

Route (app)
┌ ○ /
├ ○ /_not-found
├ ○ /activity
├ ƒ /api/assistant/chat
├ ƒ /api/assistant/conversations/[id]
├ ƒ /api/case
├ ƒ /api/cases/[id]/activity
├ ƒ /api/cases/[id]/attention-feed
├ ƒ /api/cases/[id]/custody-by-custodian
├ ƒ /api/cases/[id]/discrepancies
├ ƒ /api/cases/[id]/exhibits
├ ƒ /api/cases/[id]/exhibits/search
├ ƒ /api/cases/[id]/jury-package
├ ƒ /api/cases/[id]/jury-package/preview
├ ƒ /api/cases/[id]/objections
├ ƒ /api/discrepancies/[id]/acknowledge
├ ƒ /api/exhibits
├ ƒ /api/exhibits/[id]
├ ƒ /api/exhibits/[id]/custodian
├ ƒ /api/exhibits/[id]/custody-history
├ ƒ /api/exhibits/[id]/discrepancies
├ ƒ /api/exhibits/[id]/events/custody
├ ƒ /api/exhibits/[id]/events/objection
├ ƒ /api/exhibits/[id]/events/status
├ ƒ /api/exhibits/[id]/history
├ ƒ /api/exhibits/[id]/status
├ ƒ /api/jury-package/[id]/exhibits/[exhibitId]/exclude
├ ƒ /api/jury-package/[id]/finalize
├ ƒ /api/jury-package/[id]/request-finalization
├ ƒ /api/objections/[id]/ruling
├ ○ /assistant
├ ○ /case
├ ○ /command-center
├ ƒ /exhibit/[id]
└ ○ /jury-package


○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand


> judicialsync@0.1.0 test
> vitest run


[1m[46m RUN [49m[22m [36mv3.2.7 [39m[90m/home/daytona/project[39m

 [32m✓[39m src/data/seed.test.ts [2m([22m[2m8 tests[22m[2m)[22m[33m 106892[2mms[22m[39m
   [33m[2m✓[22m[39m seed loader (F0a)[2m > [22mproduces all three planted edge cases on first run [33m 13406[2mms[22m[39m
   [33m[2m✓[22m[39m seed loader (F0a)[2m > [22mblocks admission of the planted single-reason and dual-reason fixtures (F12 demo-blocking guarantee) [33m 13372[2mms[22m[39m
   [33m[2m✓[22m[39m seed loader (F0a)[2m > [22mplants exactly one sealed exhibit (S-1) as Phase 2 role-based-visibility fixture [33m 13361[2mms[22m[39m
   [33m[2m✓[22m[39m seed loader (F0a)[2m > [22massertSeedIntegrity rejects a seed with zero sealed exhibits [33m 26698[2mms[22m[39m
   [33m[2m✓[22m[39m seed loader (F0a)[2m > [22mis deterministic across a clean-state re-run: identical count, same edge cases, no duplicate case [33m 26694[2mms[22m[39m
   [33m[2m✓[22m[39m seed loader (F0a)[2m > [22mplants P-6/P-7 as ADMITTED legacy fixtures firing their F6 rules through the live engine [33m 13355[2mms[22m[39m
 [32m✓[39m src/app/api/assistant/chat/route.test.ts [2m([22m[2m19 tests[22m[2m | [22m[33m3 skipped[39m[2m)[22m[33m 55364[2mms[22m[39m
   [33m[2m✓[22m[39m POST /api/assistant/chat[2m > [22mgrounded-or-decline behavior (real ANTHROPIC_API_KEY present)[2m > [22mresolves "what exhibits were admitted yesterday" as grounded (>=1 real citation) OR a zero-citation Decline — never ungrounded [33m 4003[2mms[22m[39m
   [33m[2m✓[22m[39m POST /api/assistant/chat[2m > [22mgrounded-or-decline behavior (real ANTHROPIC_API_KEY present)[2m > [22mresolves "what objections remain unresolved" as grounded (>=1 real citation) OR a zero-citation Decline — never ungrounded [33m 5279[2mms[22m[39m
   [33m[2m✓[22m[39m POST /api/assistant/chat[2m > [22mgrounded-or-decline behavior (real ANTHROPIC_API_KEY present)[2m > [22mresolves "is P-4 in the jury package" as grounded (>=1 real citation) OR a zero-citation Decline — never ungrounded [33m 3954[2mms[22m[39m
   [33m[2m✓[22m[39m POST /api/assistant/chat[2m > [22mgrounded-or-decline behavior (real ANTHROPIC_API_KEY present)[2m > [22mresolves "who currently has custody of P-4" as grounded (>=1 real citation) OR a zero-citation Decline — never ungrounded [33m 3161[2mms[22m[39m
   [33m[2m✓[22m[39m POST /api/assistant/chat[2m > [22mgrounded-or-decline behavior (real ANTHROPIC_API_KEY present)[2m > [22mresolves "what happened to P-3" as grounded (>=1 real citation) OR a zero-citation Decline — never ungrounded [33m 7828[2mms[22m[39m
   [33m[2m✓[22m[39m POST /api/assistant/chat[2m > [22mgrounded-or-decline behavior (real ANTHROPIC_API_KEY present)[2m > [22m"what exhibits were admitted yesterday" carries >=1 pill when grounded (searchExhibits path) [33m 4724[2mms[22m[39m
   [33m[2m✓[22m[39m POST /api/assistant/chat[2m > [22mgrounded-or-decline behavior (real ANTHROPIC_API_KEY present)[2m > [22m04-UAT.md test 7 repro: a decline on "what exhibits were admitted yesterday" ALWAYS carries citations: [] even though searchExhibits returned rows this turn [33m 3694[2mms[22m[39m
   [33m[2m✓[22m[39m POST /api/assistant/chat[2m > [22mgrounded-or-decline behavior (real ANTHROPIC_API_KEY present)[2m > [22mno-over-correction guard: a genuinely grounded answer ("who currently has custody of P-4") still carries >=1 citation [33m 3256[2mms[22m[39m
   [33m[2m✓[22m[39m POST /api/assistant/chat[2m > [22mgrounded-or-decline behavior (real ANTHROPIC_API_KEY present)[2m > [22msealed DEPUTY probe Declines indistinguishably from not-found (criterion 4) [33m 2483[2mms[22m[39m
   [33m[2m✓[22m[39m POST /api/assistant/chat[2m > [22mgrounded-or-decline behavior (real ANTHROPIC_API_KEY present)[2m > [22memits the data-citations frame on the live stream (writer-merge-then-write timing) — W3 [33m 3585[2mms[22m[39m
 [32m✓[39m src/services/rebuild.test.ts [2m([22m[2m3 tests[22m[2m)[22m[33m 26776[2mms[22m[39m
 [32m✓[39m src/app/api/case/route.test.ts [2m([22m[2m2 tests[22m[2m)[22m[33m 26764[2mms[22m[39m
 [32m✓[39m src/services/history.test.ts [2m([22m[2m15 tests[22m[2m)[22m[33m 13542[2mms[22m[39m
 [32m✓[39m src/lib/assistant/tools.test.ts [2m([22m[2m8 tests[22m[2m)[22m[33m 13421[2mms[22m[39m
 [32m✓[39m src/services/cases.test.ts [2m([22m[2m2 tests[22m[2m)[22m[33m 13411[2mms[22m[39m
 [32m✓[39m src/services/assistant.test.ts [2m([22m[2m3 tests[22m[2m)[22m[33m 13401[2mms[22m[39m
 [32m✓[39m src/lib/assistant/schema.test.ts [2m([22m[2m4 tests[22m[2m)[22m[33m 13402[2mms[22m[39m
 [32m✓[39m src/services/juryPackage.test.ts [2m([22m[2m22 tests[22m[2m)[22m[33m 426[2mms[22m[39m
 [32m✓[39m src/app/api/discrepancies/[id]/acknowledge/route.test.ts [2m([22m[2m9 tests[22m[2m)[22m[32m 224[2mms[22m[39m
 [32m✓[39m src/app/api/cases/[id]/jury-package/route.test.ts [2m([22m[2m5 tests[22m[2m)[22m[32m 163[2mms[22m[39m
 [32m✓[39m src/services/discrepancies.test.ts [2m([22m[2m11 tests[22m[2m)[22m[32m 157[2mms[22m[39m
 [32m✓[39m src/app/api/jury-package/[id]/request-finalization/route.test.ts [2m([22m[2m4 tests[22m[2m)[22m[32m 146[2mms[22m[39m
 [32m✓[39m src/services/exhibits.test.ts [2m([22m[2m32 tests[22m[2m)[22m[32m 136[2mms[22m[39m
 [32m✓[39m src/app/api/jury-package/[id]/finalize/route.test.ts [2m([22m[2m3 tests[22m[2m)[22m[32m 137[2mms[22m[39m
 [32m✓[39m src/services/admissionGate.test.ts [2m([22m[2m7 tests[22m[2m)[22m[32m 121[2mms[22m[39m
 [32m✓[39m src/app/api/jury-package/[id]/exhibits/[exhibitId]/exclude/route.test.ts [2m([22m[2m6 tests[22m[2m)[22m[32m 114[2mms[22m[39m
 [32m✓[39m src/services/activity.test.ts [2m([22m[2m9 tests[22m[2m)[22m[32m 101[2mms[22m[39m
 [32m✓[39m src/app/api/objections/[id]/ruling/route.test.ts [2m([22m[2m10 tests[22m[2m)[22m[32m 111[2mms[22m[39m
 [32m✓[39m src/services/attentionFeed.test.ts [2m([22m[2m5 tests[22m[2m)[22m[32m 94[2mms[22m[39m
 [32m✓[39m src/services/objections.test.ts [2m([22m[2m8 tests[22m[2m)[22m[32m 82[2mms[22m[39m
 [32m✓[39m src/app/api/exhibits/[id]/events/status/route.test.ts [2m([22m[2m8 tests[22m[2m)[22m[32m 84[2mms[22m[39m
 [32m✓[39m src/services/custody.test.ts [2m([22m[2m10 tests[22m[2m)[22m[32m 81[2mms[22m[39m
 [32m✓[39m src/services/status.test.ts [2m([22m[2m4 tests[22m[2m)[22m[32m 68[2mms[22m[39m
 [32m✓[39m src/app/api/cases/[id]/discrepancies/route.test.ts [2m([22m[2m2 tests[22m[2m)[22m[32m 60[2mms[22m[39m
 [32m✓[39m src/app/api/exhibits/[id]/events/custody/route.test.ts [2m([22m[2m7 tests[22m[2m)[22m[32m 64[2mms[22m[39m
 [32m✓[39m src/services/custodyByCustodian.test.ts [2m([22m[2m2 tests[22m[2m)[22m[32m 57[2mms[22m[39m
 [32m✓[39m tests/boot.test.ts [2m([22m[2m3 tests[22m[2m)[22m[32m 64[2mms[22m[39m
 [32m✓[39m src/app/api/cases/[id]/exhibits/route.test.ts [2m([22m[2m5 tests[22m[2m)[22m[32m 54[2mms[22m[39m
 [32m✓[39m src/app/api/cases/[id]/activity/route.test.ts [2m([22m[2m5 tests[22m[2m)[22m[32m 52[2mms[22m[39m
 [32m✓[39m src/app/api/cases/[id]/exhibits/search/route.test.ts [2m([22m[2m8 tests[22m[2m)[22m[32m 50[2mms[22m[39m
 [32m✓[39m src/app/api/cases/[id]/custody-by-custodian/route.test.ts [2m([22m[2m2 tests[22m[2m)[22m[32m 45[2mms[22m[39m
 [32m✓[39m src/app/api/exhibits/[id]/history/route.test.ts [2m([22m[2m4 tests[22m[2m)[22m[32m 43[2mms[22m[39m
 [32m✓[39m src/app/api/exhibits/route.test.ts [2m([22m[2m4 tests[22m[2m)[22m[32m 43[2mms[22m[39m
 [32m✓[39m src/app/api/cases/[id]/attention-feed/route.test.ts [2m([22m[2m2 tests[22m[2m)[22m[32m 43[2mms[22m[39m
 [32m✓[39m src/services/events.test.ts [2m([22m[2m2 tests[22m[2m)[22m[32m 30[2mms[22m[39m
 [32m✓[39m src/app/api/exhibits/[id]/route.test.ts [2m([22m[2m4 tests[22m[2m)[22m[32m 31[2mms[22m[39m
 [32m✓[39m src/services/visibility.test.ts [2m([22m[2m6 tests[22m[2m)[22m[32m 4[2mms[22m[39m
 [32m✓[39m src/components/shared/TwoColorProgressBar.test.ts [2m([22m[2m6 tests[22m[2m)[22m[32m 2[2mms[22m[39m
 [32m✓[39m src/components/shared/SeverityPill.test.ts [2m([22m[2m6 tests[22m[2m)[22m[32m 1[2mms[22m[39m
 [32m✓[39m src/hooks/useFreshness.test.ts [2m([22m[2m8 tests[22m[2m)[22m[32m 1[2mms[22m[39m

[2m Test Files [22m [1m[32m42 passed[39m[22m[90m (42)[39m
[2m      Tests [22m [1m[32m290 passed[39m[22m[2m | [22m[33m3 skipped[39m[90m (293)[39m
[2m   Start at [22m 18:59:07
[2m   Duration [22m 290.70s[2m (transform 414ms, setup 0ms, collect 1.96s, tests 285.86s, environment 3ms, prepare 1.03s)[22m
```

## Wave 4

- Build: `npm run build` → pass
- Tests: `npm test` → pass
- Fix attempts: 0/3

### Gate output

```
> judicialsync@0.1.0 build
> next build

▲ Next.js 16.4.0 (Turbopack)
- Environments: .env
✓ Running next.config.ts took 11ms

  Creating an optimized production build ...
✓ Compiled successfully in 6.6s
  Running TypeScript ...
  Finished TypeScript in 1567ms ...
  Collecting page data using 1 worker ...
  Generating static pages using 1 worker (0/11) ...
  Generating static pages using 1 worker (2/11) 
  Generating static pages using 1 worker (5/11) 
  Generating static pages using 1 worker (8/11) 
[@carbon/feature-flags] `enable-v12-tile-default-icons` is available but not enabled.
Enable rendering of default icons in the tile components
This becomes the default behavior in v12. Enable it to migrate early, or enable `enable-v12-release` to turn on every v12 flag at once.
✓ Generating static pages using 1 worker (11/11) in 221ms
  Finalizing page optimization ...

Route (app)
┌ ○ /
├ ○ /_not-found
├ ○ /activity
├ ƒ /api/assistant/chat
├ ƒ /api/assistant/conversations/[id]
├ ƒ /api/case
├ ƒ /api/cases/[id]/activity
├ ƒ /api/cases/[id]/attention-feed
├ ƒ /api/cases/[id]/custody-by-custodian
├ ƒ /api/cases/[id]/discrepancies
├ ƒ /api/cases/[id]/exhibits
├ ƒ /api/cases/[id]/exhibits/search
├ ƒ /api/cases/[id]/jury-package
├ ƒ /api/cases/[id]/jury-package/preview
├ ƒ /api/cases/[id]/objections
├ ƒ /api/discrepancies/[id]/acknowledge
├ ƒ /api/exhibits
├ ƒ /api/exhibits/[id]
├ ƒ /api/exhibits/[id]/custodian
├ ƒ /api/exhibits/[id]/custody-history
├ ƒ /api/exhibits/[id]/discrepancies
├ ƒ /api/exhibits/[id]/events/custody
├ ƒ /api/exhibits/[id]/events/objection
├ ƒ /api/exhibits/[id]/events/status
├ ƒ /api/exhibits/[id]/history
├ ƒ /api/exhibits/[id]/status
├ ƒ /api/jury-package/[id]/exhibits/[exhibitId]/exclude
├ ƒ /api/jury-package/[id]/finalize
├ ƒ /api/jury-package/[id]/request-finalization
├ ƒ /api/objections/[id]/ruling
├ ○ /assistant
├ ○ /case
├ ○ /command-center
├ ƒ /exhibit/[id]
└ ○ /jury-package


○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand


> judicialsync@0.1.0 test
> vitest run


[1m[46m RUN [49m[22m [36mv3.2.7 [39m[90m/home/daytona/project[39m

 [32m✓[39m src/data/seed.test.ts [2m([22m[2m8 tests[22m[2m)[22m[33m 106913[2mms[22m[39m
   [33m[2m✓[22m[39m seed loader (F0a)[2m > [22mproduces all three planted edge cases on first run [33m 13421[2mms[22m[39m
   [33m[2m✓[22m[39m seed loader (F0a)[2m > [22mblocks admission of the planted single-reason and dual-reason fixtures (F12 demo-blocking guarantee) [33m 13360[2mms[22m[39m
   [33m[2m✓[22m[39m seed loader (F0a)[2m > [22mplants exactly one sealed exhibit (S-1) as Phase 2 role-based-visibility fixture [33m 13364[2mms[22m[39m
   [33m[2m✓[22m[39m seed loader (F0a)[2m > [22massertSeedIntegrity rejects a seed with zero sealed exhibits [33m 26710[2mms[22m[39m
   [33m[2m✓[22m[39m seed loader (F0a)[2m > [22mis deterministic across a clean-state re-run: identical count, same edge cases, no duplicate case [33m 26695[2mms[22m[39m
   [33m[2m✓[22m[39m seed loader (F0a)[2m > [22mplants P-6/P-7 as ADMITTED legacy fixtures firing their F6 rules through the live engine [33m 13356[2mms[22m[39m
 [32m✓[39m src/app/api/assistant/chat/route.test.ts [2m([22m[2m19 tests[22m[2m | [22m[33m3 skipped[39m[2m)[22m[33m 55448[2mms[22m[39m
   [33m[2m✓[22m[39m POST /api/assistant/chat[2m > [22mgrounded-or-decline behavior (real ANTHROPIC_API_KEY present)[2m > [22mresolves "what exhibits were admitted yesterday" as grounded (>=1 real citation) OR a zero-citation Decline — never ungrounded [33m 4211[2mms[22m[39m
   [33m[2m✓[22m[39m POST /api/assistant/chat[2m > [22mgrounded-or-decline behavior (real ANTHROPIC_API_KEY present)[2m > [22mresolves "what objections remain unresolved" as grounded (>=1 real citation) OR a zero-citation Decline — never ungrounded [33m 5503[2mms[22m[39m
   [33m[2m✓[22m[39m POST /api/assistant/chat[2m > [22mgrounded-or-decline behavior (real ANTHROPIC_API_KEY present)[2m > [22mresolves "is P-4 in the jury package" as grounded (>=1 real citation) OR a zero-citation Decline — never ungrounded [33m 3741[2mms[22m[39m
   [33m[2m✓[22m[39m POST /api/assistant/chat[2m > [22mgrounded-or-decline behavior (real ANTHROPIC_API_KEY present)[2m > [22mresolves "who currently has custody of P-4" as grounded (>=1 real citation) OR a zero-citation Decline — never ungrounded [33m 3065[2mms[22m[39m
   [33m[2m✓[22m[39m POST /api/assistant/chat[2m > [22mgrounded-or-decline behavior (real ANTHROPIC_API_KEY present)[2m > [22mresolves "what happened to P-3" as grounded (>=1 real citation) OR a zero-citation Decline — never ungrounded [33m 6775[2mms[22m[39m
   [33m[2m✓[22m[39m POST /api/assistant/chat[2m > [22mgrounded-or-decline behavior (real ANTHROPIC_API_KEY present)[2m > [22m"what exhibits were admitted yesterday" carries >=1 pill when grounded (searchExhibits path) [33m 3580[2mms[22m[39m
   [33m[2m✓[22m[39m POST /api/assistant/chat[2m > [22mgrounded-or-decline behavior (real ANTHROPIC_API_KEY present)[2m > [22m04-UAT.md test 7 repro: a decline on "what exhibits were admitted yesterday" ALWAYS carries citations: [] even though searchExhibits returned rows this turn [33m 6270[2mms[22m[39m
   [33m[2m✓[22m[39m POST /api/assistant/chat[2m > [22mgrounded-or-decline behavior (real ANTHROPIC_API_KEY present)[2m > [22mno-over-correction guard: a genuinely grounded answer ("who currently has custody of P-4") still carries >=1 citation [33m 3016[2mms[22m[39m
   [33m[2m✓[22m[39m POST /api/assistant/chat[2m > [22mgrounded-or-decline behavior (real ANTHROPIC_API_KEY present)[2m > [22msealed DEPUTY probe Declines indistinguishably from not-found (criterion 4) [33m 2417[2mms[22m[39m
   [33m[2m✓[22m[39m POST /api/assistant/chat[2m > [22mgrounded-or-decline behavior (real ANTHROPIC_API_KEY present)[2m > [22memits the data-citations frame on the live stream (writer-merge-then-write timing) — W3 [33m 3461[2mms[22m[39m
 [32m✓[39m src/services/rebuild.test.ts [2m([22m[2m3 tests[22m[2m)[22m[33m 26808[2mms[22m[39m
 [32m✓[39m src/app/api/case/route.test.ts [2m([22m[2m2 tests[22m[2m)[22m[33m 26759[2mms[22m[39m
 [32m✓[39m src/services/history.test.ts [2m([22m[2m15 tests[22m[2m)[22m[33m 13566[2mms[22m[39m
 [32m✓[39m src/lib/assistant/tools.test.ts [2m([22m[2m8 tests[22m[2m)[22m[33m 13419[2mms[22m[39m
 [32m✓[39m src/services/cases.test.ts [2m([22m[2m2 tests[22m[2m)[22m[33m 13408[2mms[22m[39m
 [32m✓[39m src/lib/assistant/schema.test.ts [2m([22m[2m4 tests[22m[2m)[22m[33m 13417[2mms[22m[39m
 [32m✓[39m src/services/assistant.test.ts [2m([22m[2m3 tests[22m[2m)[22m[33m 13416[2mms[22m[39m
 [32m✓[39m src/services/juryPackage.test.ts [2m([22m[2m22 tests[22m[2m)[22m[33m 417[2mms[22m[39m
 [32m✓[39m src/app/api/discrepancies/[id]/acknowledge/route.test.ts [2m([22m[2m9 tests[22m[2m)[22m[32m 224[2mms[22m[39m
 [32m✓[39m src/app/api/cases/[id]/jury-package/route.test.ts [2m([22m[2m5 tests[22m[2m)[22m[32m 181[2mms[22m[39m
 [32m✓[39m src/services/discrepancies.test.ts [2m([22m[2m11 tests[22m[2m)[22m[32m 166[2mms[22m[39m
 [32m✓[39m src/app/api/jury-package/[id]/request-finalization/route.test.ts [2m([22m[2m4 tests[22m[2m)[22m[32m 149[2mms[22m[39m
 [32m✓[39m src/app/api/jury-package/[id]/finalize/route.test.ts [2m([22m[2m3 tests[22m[2m)[22m[32m 138[2mms[22m[39m
 [32m✓[39m src/services/exhibits.test.ts [2m([22m[2m32 tests[22m[2m)[22m[32m 135[2mms[22m[39m
 [32m✓[39m src/services/admissionGate.test.ts [2m([22m[2m7 tests[22m[2m)[22m[32m 111[2mms[22m[39m
 [32m✓[39m src/app/api/jury-package/[id]/exhibits/[exhibitId]/exclude/route.test.ts [2m([22m[2m6 tests[22m[2m)[22m[32m 112[2mms[22m[39m
 [32m✓[39m src/app/api/objections/[id]/ruling/route.test.ts [2m([22m[2m10 tests[22m[2m)[22m[32m 105[2mms[22m[39m
 [32m✓[39m src/services/activity.test.ts [2m([22m[2m9 tests[22m[2m)[22m[32m 99[2mms[22m[39m
 [32m✓[39m src/services/attentionFeed.test.ts [2m([22m[2m5 tests[22m[2m)[22m[32m 99[2mms[22m[39m
 [32m✓[39m src/app/api/exhibits/[id]/events/status/route.test.ts [2m([22m[2m8 tests[22m[2m)[22m[32m 80[2mms[22m[39m
 [32m✓[39m src/services/objections.test.ts [2m([22m[2m8 tests[22m[2m)[22m[32m 87[2mms[22m[39m
 [32m✓[39m src/services/custody.test.ts [2m([22m[2m10 tests[22m[2m)[22m[32m 86[2mms[22m[39m
 [32m✓[39m src/services/status.test.ts [2m([22m[2m4 tests[22m[2m)[22m[32m 71[2mms[22m[39m
 [32m✓[39m src/app/api/exhibits/[id]/events/custody/route.test.ts [2m([22m[2m7 tests[22m[2m)[22m[32m 65[2mms[22m[39m
 [32m✓[39m tests/boot.test.ts [2m([22m[2m3 tests[22m[2m)[22m[32m 68[2mms[22m[39m
 [32m✓[39m src/app/api/cases/[id]/discrepancies/route.test.ts [2m([22m[2m2 tests[22m[2m)[22m[32m 55[2mms[22m[39m
 [32m✓[39m src/services/custodyByCustodian.test.ts [2m([22m[2m2 tests[22m[2m)[22m[32m 56[2mms[22m[39m
 [32m✓[39m src/app/api/cases/[id]/exhibits/route.test.ts [2m([22m[2m5 tests[22m[2m)[22m[32m 53[2mms[22m[39m
 [32m✓[39m src/app/api/cases/[id]/activity/route.test.ts [2m([22m[2m5 tests[22m[2m)[22m[32m 54[2mms[22m[39m
 [32m✓[39m src/app/api/cases/[id]/exhibits/search/route.test.ts [2m([22m[2m8 tests[22m[2m)[22m[32m 50[2mms[22m[39m
 [32m✓[39m src/app/api/cases/[id]/custody-by-custodian/route.test.ts [2m([22m[2m2 tests[22m[2m)[22m[32m 42[2mms[22m[39m
 [32m✓[39m src/app/api/exhibits/[id]/history/route.test.ts [2m([22m[2m4 tests[22m[2m)[22m[32m 43[2mms[22m[39m
 [32m✓[39m src/app/api/cases/[id]/attention-feed/route.test.ts [2m([22m[2m2 tests[22m[2m)[22m[32m 40[2mms[22m[39m
 [32m✓[39m src/app/api/exhibits/route.test.ts [2m([22m[2m4 tests[22m[2m)[22m[32m 44[2mms[22m[39m
 [32m✓[39m src/app/api/exhibits/[id]/route.test.ts [2m([22m[2m4 tests[22m[2m)[22m[32m 30[2mms[22m[39m
 [32m✓[39m src/services/events.test.ts [2m([22m[2m2 tests[22m[2m)[22m[32m 29[2mms[22m[39m
 [32m✓[39m src/services/visibility.test.ts [2m([22m[2m6 tests[22m[2m)[22m[32m 4[2mms[22m[39m
 [32m✓[39m src/components/shared/TwoColorProgressBar.test.ts [2m([22m[2m6 tests[22m[2m)[22m[32m 2[2mms[22m[39m
 [32m✓[39m src/hooks/useFreshness.test.ts [2m([22m[2m8 tests[22m[2m)[22m[32m 1[2mms[22m[39m
 [32m✓[39m src/components/shared/SeverityPill.test.ts [2m([22m[2m6 tests[22m[2m)[22m[32m 1[2mms[22m[39m

[2m Test Files [22m [1m[32m42 passed[39m[22m[90m (42)[39m
[2m      Tests [22m [1m[32m290 passed[39m[22m[2m | [22m[33m3 skipped[39m[90m (293)[39m
[2m   Start at [22m 19:12:28
[2m   Duration [22m 290.87s[2m (transform 389ms, setup 0ms, collect 1.96s, tests 286.05s, environment 3ms, prepare 1.02s)[22m
```

