// Configuration types and utilities
export type {
  GraphiQLConfig,
  GraphQLRouterConfig,
  GraphQLRouterConfigInput,
} from "./config"

export {
  defaultConfig,
  normalizeConfig,
  GraphQLRouterConfigFromEnv,
} from "./config"

// GraphiQL HTML generator
export { graphiqlHtml } from "./graphiql"

// Router factory
export { makeGraphQLRouter } from "./router"

// Schema builder extension
export { toRouter } from "./schema-builder-extensions"
