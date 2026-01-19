import { defineConfig } from "vitest/config"
import path from "path"
import { createRequire } from "module"

// Resolve graphql from @effect-gql/core's location to ensure single instance
const require = createRequire(import.meta.url)
const coreGraphqlPath = path.dirname(
  require.resolve("graphql", { paths: [path.resolve(__dirname, "../core")] })
)

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["test/**/*.test.ts"],
    exclude: ["node_modules", "dist"],
    testTimeout: 10000,
    hookTimeout: 10000,
  },
  resolve: {
    alias: {
      "@effect-gql/core": path.resolve(__dirname, "../core/src"),
      // Ensure all graphql imports resolve to the same instance used by @effect-gql/core
      graphql: coreGraphqlPath,
    },
  },
})
