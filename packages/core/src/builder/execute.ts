import { Effect, Layer, Runtime } from "effect"
import { GraphQLSchema, graphql } from "graphql"
import type { GraphQLEffectContext } from "./types"

/**
 * Execute a GraphQL query with a service layer
 *
 * This is the layer-per-request execution model. Build the schema once,
 * then execute each request with its own layer (including request-scoped services).
 */
export const execute = <R>(
  schema: GraphQLSchema,
  layer: Layer.Layer<R>
) => (
  source: string,
  variableValues?: Record<string, unknown>,
  operationName?: string
): Effect.Effect<any, Error> =>
  Effect.gen(function*() {
    // Create runtime from the provided layer
    const runtime = yield* Effect.runtime<R>()

    // Execute GraphQL with runtime in context
    const result = yield* Effect.tryPromise({
      try: () => graphql({
        schema,
        source,
        variableValues,
        operationName,
        contextValue: { runtime } satisfies GraphQLEffectContext<R>
      }),
      catch: (error) => new Error(String(error))
    })

    return result
  }).pipe(Effect.provide(layer))
