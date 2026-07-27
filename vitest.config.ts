import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Business rules are computed on local dates; pin the timezone so results are deterministic.
    env: { TZ: "UTC" },
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/lib/**/*.ts"]
    }
  }
});
