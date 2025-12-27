import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["test/**/*.test.ts"],
    exclude: ["node_modules", "dist"],
    testTimeout: 10000,
    hookTimeout: 10000,
    // Use deps.optimizer to ensure single graphql instance
    deps: {
      optimizer: {
        web: {
          include: ["graphql"],
        },
      },
    },
  },
  resolve: {
    // Ensure graphql resolves to the same instance across all packages
    dedupe: ["graphql"],
    alias: {
      "graphql": path.resolve(__dirname, "../../node_modules/graphql"),
    },
  },
})
