import { Effect, Context, Layer } from "effect"
import type { User, Post } from "./types"

// Services
export class DatabaseService extends Context.Tag("DatabaseService")<
  DatabaseService,
  {
    readonly getUser: (id: string) => Effect.Effect<User, Error>
    readonly getUsers: () => Effect.Effect<User[], Error>
    readonly createUser: (name: string, email: string) => Effect.Effect<User, Error>
    readonly getPostsForUser: (userId: string) => Effect.Effect<Post[], Error>
    readonly getAuthor: (authorId: string) => Effect.Effect<User, Error>
  }
>() {}

export class LoggerService extends Context.Tag("LoggerService")<
  LoggerService,
  {
    readonly info: (message: string) => Effect.Effect<void>
  }
>() {}

// Mock data
const users: User[] = [
  { id: "1", name: "Alice", email: "alice@example.com" },
  { id: "2", name: "Bob", email: "bob@example.com" },
]

const posts: Post[] = [
  { id: "1", title: "First Post", content: "Hello world", authorId: "1" },
  { id: "2", title: "Second Post", content: "More content", authorId: "1" },
  { id: "3", title: "Bob's Post", content: "Bob's content", authorId: "2" },
]

// Service implementations
export const DatabaseServiceLive = Layer.succeed(DatabaseService, {
  getUser: (id: string) =>
    Effect.sync(() => {
      const user = users.find(u => u.id === id)
      if (!user) throw new Error(`User ${id} not found`)
      return user
    }),
  getUsers: () => Effect.succeed(users),
  createUser: (name: string, email: string) =>
    Effect.sync(() => {
      const user: User = { id: String(users.length + 1), name, email }
      users.push(user)
      return user
    }),
  getPostsForUser: (userId: string) =>
    Effect.succeed(posts.filter(p => p.authorId === userId)),
  getAuthor: (authorId: string) =>
    Effect.sync(() => {
      const author = users.find(u => u.id === authorId)
      if (!author) throw new Error(`Author ${authorId} not found`)
      return author
    }),
})

export const LoggerServiceLive = Layer.succeed(LoggerService, {
  info: (message: string) =>
    Effect.sync(() => console.log(`[INFO] ${message}`)),
})
