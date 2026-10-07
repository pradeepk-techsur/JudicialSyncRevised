# Deferred Items — Phase 02 Core Screens

Out-of-scope discoveries logged during plan execution (not fixed here — owned by
another plan or phase).

## From 02-03 execution

- **Project build (`npm run build`) currently fails** — `src/app/api/exhibits/[id]/route.ts`
  imports `@/services/visibility` (`parseRequestingRole`), a module that does not
  yet exist. This file and the missing `@/services/visibility` module are owned by
  the parallel wave-1 plan **02-02** (role-based visibility), which was still
  in-flight at the time 02-03 completed. The same in-flight state also produces
  `tsc` errors in `src/services/exhibits.test.ts` and `src/services/visibility.test.ts`.
  None of these touch 02-03's files (`src/lib/constants.ts`, `src/data/seed.ts`,
  `src/data/seed.test.ts`, `src/services/cases.ts`, `src/services/cases.test.ts`,
  `src/app/api/case/route.ts`, `src/app/api/case/route.test.ts`), which compile and
  test cleanly in isolation. The build is expected to go green once 02-02 lands its
  `@/services/visibility` module. No action for 02-03.
