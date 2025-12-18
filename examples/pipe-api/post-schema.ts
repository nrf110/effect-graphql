import { Effect } from "effect"
import { objectType } from "../../src/builder"
import { PostSchema, UserSchema, type Post } from "./types"
import { DatabaseService } from "./services"

/**
 * Post type definition with its fields
 */
export const postType = objectType({
  name: "Post",
  schema: PostSchema,
  fields: {
    author: {
      type: UserSchema,
      description: "The author of this post",
      resolve: (parent: Post) =>
        Effect.gen(function*() {
          const db = yield* DatabaseService
          return yield* db.getAuthor(parent.authorId)
        }),
    },
  },
})
