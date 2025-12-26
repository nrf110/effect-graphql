import { Effect, Layer, Context } from "effect"
import * as S from "effect/Schema"
import { GraphQLSchemaBuilder, execute, query } from "@effect-gql/core"
import { withTracing, tracingExtension, resolverTracingMiddleware } from "@effect-gql/opentelemetry"
import { printSchema } from "graphql"

/**
 * Example: OpenTelemetry Tracing
 *
 * Demonstrates:
 * - Adding OpenTelemetry tracing to a GraphQL schema
 * - Phase-level spans (parse, validate, execute)
 * - Resolver-level spans for each field
 * - Configuration options for tracing
 * - Using withTracing() for easy setup
 *
 * Prerequisites:
 * - npm install @effect/opentelemetry @opentelemetry/sdk-trace-base @opentelemetry/api
 *
 * To see traces in a backend like Jaeger:
 * 1. Run Jaeger: docker run -d -p 16686:16686 -p 4318:4318 jaegertracing/all-in-one
 * 2. Add OTLPTraceExporter to send traces to localhost:4318
 * 3. View traces at http://localhost:16686
 */

// ============================================================================
// User Service (simulates database access)
// ============================================================================

interface User {
  id: string
  name: string
  email: string
}

class UserService extends Context.Tag("UserService")<
  UserService,
  {
    readonly getById: (id: string) => Effect.Effect<User | null>
    readonly getAll: () => Effect.Effect<User[]>
  }
>() {}

const UserServiceLive = Layer.succeed(
  UserService,
  UserService.of({
    getById: (id) =>
      Effect.gen(function* () {
        // Simulate database delay
        yield* Effect.sleep("50 millis")
        const users: Record<string, User> = {
          "1": { id: "1", name: "Alice", email: "alice@example.com" },
          "2": { id: "2", name: "Bob", email: "bob@example.com" },
        }
        return users[id] ?? null
      }),
    getAll: () =>
      Effect.gen(function* () {
        yield* Effect.sleep("100 millis")
        return [
          { id: "1", name: "Alice", email: "alice@example.com" },
          { id: "2", name: "Bob", email: "bob@example.com" },
          { id: "3", name: "Charlie", email: "charlie@example.com" },
        ]
      }),
  })
)

// ============================================================================
// Schema Definition
// ============================================================================

const UserSchema = S.Struct({
  id: S.String,
  name: S.String,
  email: S.String,
})

// ============================================================================
// Approach 1: Using withTracing() (Recommended)
// ============================================================================

/**
 * The simplest way to add tracing - use withTracing() in the builder pipe.
 * This adds both the tracing extension (for phases) and middleware (for resolvers).
 */
const simpleBuilder = GraphQLSchemaBuilder.empty.pipe(
  // Add queries
  query("user", {
    type: S.NullOr(UserSchema),
    args: S.Struct({ id: S.String }),
    resolve: (args) =>
      Effect.gen(function* () {
        const userService = yield* UserService
        return yield* userService.getById(args.id)
      }),
  }),

  query("users", {
    type: S.Array(UserSchema),
    resolve: () =>
      Effect.gen(function* () {
        const userService = yield* UserService
        return yield* userService.getAll()
      }),
  }),

  // Add tracing - this single call adds both extension and middleware
  withTracing({
    extension: {
      // Add trace ID to response extensions for debugging
      exposeTraceIdInResponse: true,
    },
    resolver: {
      // Skip introspection queries
      excludePatterns: [/^Query\.__/],
    },
  })
)

// ============================================================================
// Approach 2: Using Individual Components (Advanced)
// ============================================================================

/**
 * For more control, you can add the extension and middleware separately.
 * This allows different configurations or conditional usage.
 */
const advancedBuilder = GraphQLSchemaBuilder.empty
  // Add the tracing extension for phase-level spans
  .extension(
    tracingExtension({
      includeQuery: false, // Don't include query text (security)
      includeVariables: false, // Don't include variables (security)
      exposeTraceIdInResponse: true,
      customAttributes: {
        "service.name": "example-api",
        "deployment.environment": "development",
      },
    })
  )
  // Add resolver tracing middleware
  .middleware(
    resolverTracingMiddleware({
      minDepth: 0, // Trace all fields including root
      maxDepth: 10, // Limit deep nesting tracing
      includeArgs: false, // Don't include args (security)
      includeParentType: true, // Include parent type in spans
      traceIntrospection: false, // Skip __schema, __type, etc.
      // Custom span name generator
      spanNameGenerator: (info) =>
        `gql.${info.parentType.name}.${info.fieldName}`,
    })
  )
  .query("user", {
    type: S.NullOr(UserSchema),
    args: S.Struct({ id: S.String }),
    resolve: (args) =>
      Effect.gen(function* () {
        const userService = yield* UserService
        return yield* userService.getById(args.id)
      }),
  })
  .query("users", {
    type: S.Array(UserSchema),
    resolve: () =>
      Effect.gen(function* () {
        const userService = yield* UserService
        return yield* userService.getAll()
      }),
  })

// ============================================================================
// Execute and Display Results
// ============================================================================

const runExample = async () => {
  console.log("=== OpenTelemetry Tracing Example ===\n")

  const schema = simpleBuilder.buildSchema()
  const extensions = simpleBuilder.getExtensions()

  console.log("Schema:\n")
  console.log(printSchema(schema))
  console.log("\n")

  // Execute a query
  console.log("Executing query: { users { id name } }\n")

  const result = await Effect.runPromise(
    execute(schema, UserServiceLive, extensions)("{ users { id name } }")
  )

  console.log("Result:")
  console.log(JSON.stringify(result, null, 2))
  console.log("\n")

  // Execute with variables
  console.log('Executing query: { user(id: "1") { id name email } }\n')

  const result2 = await Effect.runPromise(
    execute(
      schema,
      UserServiceLive,
      extensions
    )('{ user(id: "1") { id name email } }')
  )

  console.log("Result:")
  console.log(JSON.stringify(result2, null, 2))
}

// ============================================================================
// Full Server Example with OpenTelemetry Export
// ============================================================================

/**
 * For a complete server setup with trace export, you would use:
 *
 * ```typescript
 * import { serve } from "@effect-gql/node"
 * import { NodeSdk } from "@effect/opentelemetry"
 * import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base"
 * import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http"
 *
 * // Configure OpenTelemetry
 * const TracingLayer = NodeSdk.layer(() => ({
 *   resource: {
 *     serviceName: "my-graphql-api",
 *     serviceVersion: "1.0.0",
 *   },
 *   spanProcessor: new BatchSpanProcessor(
 *     new OTLPTraceExporter({
 *       url: "http://localhost:4318/v1/traces"
 *     })
 *   )
 * }))
 *
 * // Combine service and tracing layers
 * const appLayer = TracingLayer.pipe(Layer.merge(UserServiceLive))
 *
 * // Start server with tracing
 * await serve(simpleBuilder, appLayer, {
 *   port: 4000,
 *   onStart: (url) => console.log(`GraphQL server with tracing at ${url}`)
 * })
 * ```
 */

// Run the example
runExample().catch(console.error)
