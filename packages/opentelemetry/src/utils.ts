import type { GraphQLResolveInfo, ResponsePath } from "graphql"

/**
 * Convert a GraphQL response path to a string representation.
 *
 * @example
 * // For path: Query -> users -> 0 -> posts -> 1 -> title
 * // Returns: "Query.users.0.posts.1.title"
 */
export const pathToString = (path: ResponsePath | undefined): string => {
  if (!path) return ""

  const segments: (string | number)[] = []
  let current: ResponsePath | undefined = path

  while (current) {
    segments.unshift(current.key)
    current = current.prev
  }

  return segments.join(".")
}

/**
 * Get the depth of a field in the query tree.
 * Root fields (Query.*, Mutation.*) have depth 0.
 */
export const getFieldDepth = (info: GraphQLResolveInfo): number => {
  let depth = 0
  let current: ResponsePath | undefined = info.path

  while (current?.prev) {
    // Skip array indices in depth calculation
    if (typeof current.key === "string") {
      depth++
    }
    current = current.prev
  }

  return depth
}

/**
 * Check if a field is an introspection field (__schema, __type, etc.)
 */
export const isIntrospectionField = (info: GraphQLResolveInfo): boolean => {
  return info.fieldName.startsWith("__")
}
