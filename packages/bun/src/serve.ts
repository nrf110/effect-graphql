import { Effect, Layer } from "effect"
import { HttpRouter, HttpServer } from "@effect/platform"
import { BunHttpServer, BunRuntime } from "@effect/platform-bun"

/**
 * Options for the Bun GraphQL server
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
 * Start a Bun HTTP server with the given router.
 *
 * This is the main entry point for running a GraphQL server on Bun.
 * It handles all the Effect runtime setup and server lifecycle.
 *
 * @param router - The HttpRouter to serve (typically from makeGraphQLRouter or toRouter)
 * @param layer - Layer providing the router's service dependencies
 * @param options - Server configuration options
 *
 * @example
 * ```typescript
 * import { makeGraphQLRouter } from "@effect-graphql/core"
 * import { serve } from "@effect-graphql/bun"
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

  const serverLayer = BunHttpServer.layer({ port })
  const fullLayer = Layer.merge(serverLayer, layer)

  if (onStart) {
    onStart(`http://${host === "0.0.0.0" ? "localhost" : host}:${port}`)
  }

  BunRuntime.runMain(
    Layer.launch(Layer.provide(app, fullLayer))
  )
}
