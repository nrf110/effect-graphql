import { Effect } from "effect"
import * as S from "effect/Schema"
import { objectType, query, mutation } from "../../src/builder"
import { UserSchema, PostSchema, type User } from "./types"
import { DatabaseService, LoggerService } from "./services"

/**
 * User type definition with its fields
 */
export const userType = objectType("User", UserSchema, {
  posts: {
    type: S.Array(PostSchema),
    args: S.Struct({
      limit: S.optional(S.Number),
    }),
    description: "Get posts written by this user",
    resolve: (parent: User, args: { limit?: number }) =>
      Effect.gen(function*() {
        const db = yield* DatabaseService
        const logger = yield* LoggerService
        yield* logger.info(`Fetching posts for user ${parent.id}`)
        const posts = yield* db.getPostsForUser(parent.id)
        return args.limit ? posts.slice(0, args.limit) : posts
      }),
  },
  displayName: {
    type: S.String,
    description: "Formatted display name",
    resolve: (parent: User) =>
      Effect.succeed(`${parent.name} <${parent.email}>`),
  },
})

/**
 * User queries
 */
export const userQueries = [
  query("user", {
    type: UserSchema,
    args: S.Struct({ id: S.String }),
    description: "Get a user by ID",
    resolve: (args: { id: string }) =>
      Effect.gen(function*() {
        const db = yield* DatabaseService
        const logger = yield* LoggerService
        yield* logger.info(`Fetching user ${args.id}`)
        return yield* db.getUser(args.id)
      }),
  }),

  query("users", {
    type: S.Array(UserSchema),
    description: "Get all users",
    resolve: () =>
      Effect.gen(function*() {
        const db = yield* DatabaseService
        return yield* db.getUsers()
      }),
  }),
]

/**
 * User mutations
 */
export const userMutations = [
  mutation("createUser", {
    type: UserSchema,
    args: S.Struct({
      name: S.String,
      email: S.String,
    }),
    description: "Create a new user",
    resolve: (args: { name: string; email: string }) =>
      Effect.gen(function*() {
        const db = yield* DatabaseService
        const logger = yield* LoggerService
        yield* logger.info(`Creating user ${args.name}`)
        return yield* db.createUser(args.name, args.email)
      }),
  }),
]
