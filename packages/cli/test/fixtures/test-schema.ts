/**
 * Test schema for CLI testing
 */
import { Effect } from "effect"
import * as S from "effect/Schema"
import { GraphQLSchemaBuilder, query, objectType, field } from "@effect-gql/core"

const User = S.Struct({
  id: S.String,
  name: S.String,
  email: S.String,
})

const Post = S.Struct({
  id: S.String,
  title: S.String,
  content: S.String,
})

export const builder = GraphQLSchemaBuilder.empty.pipe(
  objectType({ name: "User", schema: User }),
  objectType({ name: "Post", schema: Post }),
  field("User", "posts", {
    type: S.Array(Post),
    resolve: () => Effect.succeed([]),
  }),
  query("user", {
    type: User,
    args: S.Struct({ id: S.String }),
    resolve: ({ id }) => Effect.succeed({ id, name: "Test User", email: "test@example.com" }),
  }),
  query("users", {
    type: S.Array(User),
    resolve: () => Effect.succeed([]),
  })
)

// Also export as schema for testing that path
export const schema = builder.buildSchema()
