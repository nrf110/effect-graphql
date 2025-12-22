import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["test/**/*.test.ts", "test/**/*.integration.ts"],
    exclude: ["node_modules", "dist"],
    passWithNoTests: true,
    testTimeout: 30000,
    hookTimeout: 30000,
  },
})
