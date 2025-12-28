import type { IncomingHttpHeaders } from "node:http"

/**
 * Convert Node.js IncomingHttpHeaders to web standard Headers.
 *
 * This handles the difference between Node.js headers (which can be
 * string | string[] | undefined) and web Headers (which are always strings).
 *
 * @param nodeHeaders - Headers from IncomingMessage.headers
 * @returns A web standard Headers object
 *
 * @example
 * ```typescript
 * import { toWebHeaders } from "@effect-gql/node"
 *
 * const webHeaders = toWebHeaders(req.headers)
 * const auth = webHeaders.get("authorization")
 * ```
 */
export const toWebHeaders = (nodeHeaders: IncomingHttpHeaders): Headers => {
  const headers = new Headers()
  for (const [key, value] of Object.entries(nodeHeaders)) {
    if (value) {
      if (Array.isArray(value)) {
        value.forEach((v) => headers.append(key, v))
      } else {
        headers.set(key, value)
      }
    }
  }
  return headers
}
