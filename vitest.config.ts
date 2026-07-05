import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["tests/unit/setup.ts"],
    coverage: {
      provider: "v8",
      // `text` prints the summary in CI logs; `lcov` writes coverage/lcov.info
      // for the "Upload coverage reports" workflow step. No threshold — the
      // report is informational, not a gate.
      reporter: ["text", "lcov"],
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
});
