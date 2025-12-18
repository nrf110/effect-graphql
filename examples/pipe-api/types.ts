import * as S from "effect/Schema"

// Domain models
export const UserSchema = S.Struct({
  id: S.String,
  name: S.String,
  email: S.String,
})

export type User = S.Schema.Type<typeof UserSchema>

export const PostSchema = S.Struct({
  id: S.String,
  title: S.String,
  content: S.String,
  authorId: S.String,
})

export type Post = S.Schema.Type<typeof PostSchema>
