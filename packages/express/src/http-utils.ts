import type { IncomingHttpHeaders } from "node:http"

/**
 * Convert Node.js/Express IncomingHttpHeaders to web standard Headers.
 *
 * This handles the difference between Node.js headers (which can be
 * string | string[] | undefined) and web Headers (which are always strings).
 *
 * @param nodeHeaders - Headers from req.headers
 * @returns A web standard Headers object
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
