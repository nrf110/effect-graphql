import { Effect, Layer } from "effect"
import * as S from "effect/Schema"
import { HttpPlatform, HttpRouter, HttpServer, HttpServerRequest, HttpServerResponse } from "@effect/platform"
import { NodeHttpServer, NodeRuntime } from "@effect/platform-node"
import { graphql, GraphQLSchema } from "graphql"
import path from "path"
import { createServer } from "node:http"


const GraphQLRequestSchema = S.Struct({
  query: S.String,
  variables: S.optional(S.Record({
    key: S.String, 
    value: S.Any,
  })),
  operationName: S.optional(S.String),
})

type GraphQLRequest = S.Schema.Type<typeof GraphQLRequestSchema>

const parseGraphQLRequest = HttpServerRequest.schemaBodyJson(GraphQLRequestSchema)

/**
 * Execute a GraphQL query with Effect integration
 */
export const executeQuery = (
  schema: GraphQLSchema,
  request: GraphQLRequest,
  contextValue?: unknown
): Effect.Effect<unknown, Error> =>
  Effect.tryPromise({
    try: () =>
      graphql({
        schema,
        source: request.query,
        variableValues: request.variables,
        operationName: request.operationName,
        contextValue,
      }),
    catch: (error) => new Error(String(error)),
  })

const router = (schema: GraphQLSchema) => HttpRouter.empty.pipe(
  HttpRouter.get("/_graphiql", HttpServerResponse.file(path.join(__dirname, 'assets', "index.html"))),
  HttpRouter.post("/graphql", Effect.gen(function* () {
    const req = yield* HttpServerRequest.HttpServerRequest
    const body = yield* parseGraphQLRequest
    executeQuery(schema, body)
    return HttpServerResponse.text("Hello, world!")
  }))
)

// TODO: add schema
const app = router(new GraphQLSchema({})).pipe(
  Effect.catchAllCause((cause) =>
    HttpServerResponse.text(JSON.stringify({ error: cause }), { status: 500 })
  ),
  HttpServer.serve()
)

const listen = (
  app: Layer.Layer<
    never,
    never,
    HttpPlatform.HttpPlatform | HttpServer.HttpServer
  >,
  port: number
) =>
  NodeRuntime.runMain(
    Layer.launch(
      Layer.provide(
        app,
        NodeHttpServer.layer(() => createServer(), { port })
      )
    )
  )

listen(app, 11001)
