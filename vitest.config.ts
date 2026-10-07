import { defineConfig } from "vitest/config";

// Node environment: Phase 1 ships no UI, so no jsdom is needed. The integration
// tests produced this phase exercise the data layer / service modules directly.
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.{test,spec}.ts", "tests/**/*.{test,spec}.ts"],
  },
});
