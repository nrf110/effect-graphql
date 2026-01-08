/**
 * Multi-file schema for CLI testing
 * This imports types from a sibling file to test module resolution
 */
import { Effect } from "effect"
import * as S from "effect/Schema"
import { GraphQLSchemaBuilder, query, objectType, field } from "@effect-gql/core"

// Import from sibling file - this is what we're testing
import { User, Post } from "./types"

export const builder = GraphQLSchemaBuilder.empty.pipe(
  objectType({ name: "User", schema: User }),
  objectType({ name: "Post", schema: Post }),
  field("User", "posts", {
    type: S.Array(Post),
    resolve: () => Effect.succeed([]),
  }),
  field("Post", "author", {
    type: User,
    resolve: () => Effect.succeed({ id: "1", name: "Author", email: "author@example.com" }),
  }),
  query("user", {
    type: User,
    args: S.Struct({ id: S.String }),
    resolve: ({ id }) => Effect.succeed({ id, name: "Test User", email: "test@example.com" }),
  }),
  query("users", {
    type: S.Array(User),
    resolve: () => Effect.succeed([]),
  }),
  query("posts", {
    type: S.Array(Post),
    resolve: () => Effect.succeed([]),
  })
)

export const schema = builder.buildSchema()
