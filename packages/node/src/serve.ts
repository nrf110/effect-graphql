import { Effect, Layer } from "effect"
import { HttpRouter, HttpServer } from "@effect/platform"
import { NodeHttpServer, NodeRuntime } from "@effect/platform-node"
import { createServer } from "node:http"

/**
 * Options for the Node.js GraphQL server
 */
export interface ServeOptions {
  /** Port to listen on (default: 4000) */
  readonly port?: number
  /** Hostname to bind to (default: "0.0.0.0") */
  readonly host?: string
  /** Callback when server starts */
  readonly onStart?: (url: string) => void
}

/**
 * Start a Node.js HTTP server with the given router.
 *
 * This is the main entry point for running a GraphQL server on Node.js.
 * It handles all the Effect runtime setup and server lifecycle.
 *
 * @param router - The HttpRouter to serve (typically from makeGraphQLRouter or toRouter)
 * @param layer - Layer providing the router's service dependencies
 * @param options - Server configuration options
 *
 * @example
 * ```typescript
 * import { makeGraphQLRouter } from "@effect-graphql/core"
 * import { serve } from "@effect-graphql/node"
 *
 * const router = makeGraphQLRouter(schema, { graphiql: true })
 *
 * serve(router, serviceLayer, {
 *   port: 4000,
 *   onStart: (url) => console.log(`Server running at ${url}`)
 * })
 * ```
 */
export const serve = <E, R, RE>(
  router: HttpRouter.HttpRouter<E, R>,
  layer: Layer.Layer<R, RE>,
  options: ServeOptions = {}
): void => {
  const { port = 4000, host = "0.0.0.0", onStart } = options

  const app = router.pipe(
    Effect.catchAllCause((cause) => Effect.die(cause)),
    HttpServer.serve()
  )

  const serverLayer = NodeHttpServer.layer(() => createServer(), { port })
  const fullLayer = Layer.merge(serverLayer, layer)

  if (onStart) {
    onStart(`http://${host === "0.0.0.0" ? "localhost" : host}:${port}`)
  }

  NodeRuntime.runMain(
    Layer.launch(Layer.provide(app, fullLayer))
  )
}
