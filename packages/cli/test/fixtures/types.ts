/**
 * Shared types for multi-file schema testing
 */
import * as S from "effect/Schema"

export const User = S.Struct({
  id: S.String,
  name: S.String,
  email: S.String,
})

export const Post = S.Struct({
  id: S.String,
  title: S.String,
  content: S.String,
  authorId: S.String,
})
