import { Effect, Stream } from "effect"
import * as S from "effect/Schema"
import { DirectiveLocation } from "graphql"
import type { DirectiveApplication } from "./types"
import { GraphQLSchemaBuilder } from "./schema-builder"

/**
 * Add an object type to the schema builder (pipe-able)
 * Name is optional if schema is TaggedStruct, TaggedClass, or Schema.Class
 */
export const objectType = <A, R2 = never>(config: {
  name?: string
  schema: S.Schema<A, any, any>
  implements?: readonly string[]
  directives?: readonly DirectiveApplication[]
  fields?: Record<string, {
    type: S.Schema<any, any, any>
    args?: S.Schema<any, any, any>
    description?: string
    directives?: readonly DirectiveApplication[]
    resolve: (parent: A, args: any) => Effect.Effect<any, any, any>
  }>
}) => <R>(builder: GraphQLSchemaBuilder<R>): GraphQLSchemaBuilder<R | R2> =>
  builder.objectType(config)

/**
 * Add an interface type to the schema builder (pipe-able)
 * Name is optional if schema is TaggedStruct, TaggedClass, or Schema.Class
 */
export const interfaceType = (config: {
  name?: string
  schema: S.Schema<any, any, any>
  resolveType?: (value: any) => string
}) => <R>(builder: GraphQLSchemaBuilder<R>): GraphQLSchemaBuilder<R> =>
  builder.interfaceType(config)

/**
 * Add an enum type to the schema builder (pipe-able)
 */
export const enumType = (config: {
  name: string
  values: readonly string[]
  description?: string
}) => <R>(builder: GraphQLSchemaBuilder<R>): GraphQLSchemaBuilder<R> =>
  builder.enumType(config)

/**
 * Add a union type to the schema builder (pipe-able)
 */
export const unionType = (config: {
  name: string
  types: readonly string[]
  resolveType?: (value: any) => string
}) => <R>(builder: GraphQLSchemaBuilder<R>): GraphQLSchemaBuilder<R> =>
  builder.unionType(config)

/**
 * Add an input type to the schema builder (pipe-able)
 * Name is optional if schema is TaggedStruct, TaggedClass, or Schema.Class
 */
export const inputType = (config: {
  name?: string
  schema: S.Schema<any, any, any>
  description?: string
}) => <R>(builder: GraphQLSchemaBuilder<R>): GraphQLSchemaBuilder<R> =>
  builder.inputType(config)

/**
 * Register a directive (pipe-able)
 *
 * @param config - Directive configuration
 * @param config.name - The directive name (without @)
 * @param config.description - Optional description
 * @param config.locations - Array of DirectiveLocation values where this directive can be applied
 * @param config.args - Optional Effect Schema for directive arguments
 * @param config.apply - Optional function to transform resolver Effects (for executable directives)
 */
export const directive = <Args = void, R2 = never>(config: {
  name: string
  description?: string
  locations: readonly DirectiveLocation[]
  args?: S.Schema<Args, any, any>
  apply?: (args: Args) => <A, E, R3>(effect: Effect.Effect<A, E, R3>) => Effect.Effect<A, E, R2 | R3>
}) => <R>(builder: GraphQLSchemaBuilder<R>): GraphQLSchemaBuilder<R | R2> =>
  builder.directive(config)

/**
 * Add a query field to the schema builder (pipe-able)
 */
export const query = <A, E, R2, Args = void>(
  name: string,
  config: {
    type: S.Schema<A, any, any>
    args?: S.Schema<Args, any, any>
    description?: string
    directives?: readonly DirectiveApplication[]
    resolve: (args: Args) => Effect.Effect<A, E, R2>
  }
) => <R>(builder: GraphQLSchemaBuilder<R>): GraphQLSchemaBuilder<R | R2> =>
  builder.query(name, config)

/**
 * Add a mutation field to the schema builder (pipe-able)
 */
export const mutation = <A, E, R2, Args = void>(
  name: string,
  config: {
    type: S.Schema<A, any, any>
    args?: S.Schema<Args, any, any>
    description?: string
    directives?: readonly DirectiveApplication[]
    resolve: (args: Args) => Effect.Effect<A, E, R2>
  }
) => <R>(builder: GraphQLSchemaBuilder<R>): GraphQLSchemaBuilder<R | R2> =>
  builder.mutation(name, config)

/**
 * Add a subscription field to the schema builder (pipe-able)
 *
 * Subscriptions return a Stream that yields values over time.
 *
 * @example
 * ```typescript
 * GraphQLSchemaBuilder.empty.pipe(
 *   subscription("userCreated", {
 *     type: User,
 *     subscribe: Effect.gen(function*() {
 *       const pubsub = yield* PubSubService
 *       return pubsub.subscribe("USER_CREATED")
 *     }),
 *   })
 * )
 * ```
 */
export const subscription = <A, E, R2, Args = void>(
  name: string,
  config: {
    type: S.Schema<A, any, any>
    args?: S.Schema<Args, any, any>
    description?: string
    directives?: readonly DirectiveApplication[]
    subscribe: (args: Args) => Effect.Effect<Stream.Stream<A, E, R2>, E, R2>
    resolve?: (value: A, args: Args) => Effect.Effect<A, E, R2>
  }
) => <R>(builder: GraphQLSchemaBuilder<R>): GraphQLSchemaBuilder<R | R2> =>
  builder.subscription(name, config)

/**
 * Add a field to an existing object type (pipe-able)
 */
export const field = <Parent, A, E, R2, Args = void>(
  typeName: string,
  fieldName: string,
  config: {
    type: S.Schema<A, any, any>
    args?: S.Schema<Args, any, any>
    description?: string
    directives?: readonly DirectiveApplication[]
    resolve: (parent: Parent, args: Args) => Effect.Effect<A, E, R2>
  }
) => <R>(builder: GraphQLSchemaBuilder<R>): GraphQLSchemaBuilder<R | R2> =>
  builder.field(typeName, fieldName, config)

/**
 * Compose multiple schema operations (helper for arrays)
 */
export const compose = <R>(...operations: Array<(builder: GraphQLSchemaBuilder<any>) => GraphQLSchemaBuilder<any>>) =>
  (builder: GraphQLSchemaBuilder<R>): GraphQLSchemaBuilder<any> =>
    operations.reduce((b, op) => op(b), builder)
