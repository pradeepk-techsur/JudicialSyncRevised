import { fileURLToPath } from 'node:url';
import { defineConfig } from "vitest/config";

// Node environment: Phase 1 ships no UI, so no jsdom is needed. The integration
// tests produced this phase exercise the data layer / service modules directly.
export default defineConfig({
  resolve: {
    alias: {
      // Mirror the `@/* -> ./src/*` path mapping from tsconfig.json so service
      // and route modules can be imported under the same alias in tests.
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.{test,spec}.ts", "tests/**/*.{test,spec}.ts"],
    // Every suite here is an INTEGRATION test against the one shared Postgres,
    // and the seed-dependent suites (seed/history/rebuild) all rebuild the SAME
    // fixed-caseNumber demo case via runSeed(). Running test FILES in parallel
    // workers lets two of them reset-and-rebuild that single case concurrently,
    // which races into foreign-key violations (P2003) during resetSeedCase().
    // Serialize file execution so the shared-database fixture is never contended.
    // (Tests within a file already run sequentially.)
    fileParallelism: false,
    // Phase 7 (F15 item 6): the seed loader now inserts a small real delay
    // (~1.2s) between exhibits so most events land in visibly different displayed
    // minutes. A full runSeed() therefore takes ~11s, and the determinism test
    // runs it twice (~22s). Raise the per-test timeout above vitest's 5s default
    // so these legitimately-slow, seed-dependent integration tests do not time
    // out. (Container boot is unaffected — this is a test-runner setting only.)
    testTimeout: 60000,
    // Several suites call runSeed() in a beforeAll/beforeEach hook; with the F15
    // staggering delay a single seed is ~11s, above vitest's 10s default hook
    // timeout. Raise it in step with testTimeout above.
    hookTimeout: 60000,
  },
});
