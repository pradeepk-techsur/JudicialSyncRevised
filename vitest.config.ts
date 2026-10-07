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
  },
});
