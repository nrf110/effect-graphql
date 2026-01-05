/**
 * @effect-gql/cli - CLI tools for Effect GraphQL development
 *
 * @example CLI usage
 * ```bash
 * # Generate SDL from schema
 * effect-gql generate-schema ./src/schema.ts
 * effect-gql generate-schema ./src/schema.ts -o schema.graphql
 *
 * # Watch mode
 * effect-gql generate-schema ./src/schema.ts -o schema.graphql --watch
 *
 * # Create a new project
 * effect-gql create my-api --server-type node
 * effect-gql create my-api -s bun --monorepo
 * effect-gql create --interactive
 * ```
 *
 * @example Programmatic usage
 * ```typescript
 * import { generateSDL, generateSDLFromModule, scaffold } from "@effect-gql/cli"
 * import { Effect } from "effect"
 *
 * // From a schema directly
 * const sdl = generateSDL(builder.buildSchema())
 *
 * // From a module path
 * const sdl = await Effect.runPromise(
 *   generateSDLFromModule("./src/schema.ts")
 * )
 *
 * // Scaffold a new project programmatically
 * await Effect.runPromise(
 *   scaffold({
 *     name: "my-api",
 *     serverType: "node",
 *   })
 * )
 * ```
 */

// Generate schema command exports
export { generateSDL, generateSDLFromModule, loadSchema } from "./commands/generate-schema"

// Create command exports
export {
  runCreate,
  printCreateHelp,
  scaffold,
  SERVER_TYPES,
  isValidServerType,
} from "./commands/create"
export type { CreateOptions, ServerType, PackageManager } from "./commands/create"
