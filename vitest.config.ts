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
  },
});
