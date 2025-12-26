import { describe, it, expect } from "vitest"
import { pathToString, getFieldDepth, isIntrospectionField } from "../../src/utils"
import type { GraphQLResolveInfo, ResponsePath } from "graphql"

describe("utils.ts", () => {
  describe("pathToString", () => {
    it("should return empty string for undefined path", () => {
      expect(pathToString(undefined)).toBe("")
    })

    it("should convert a single-level path", () => {
      const path: ResponsePath = {
        prev: undefined,
        key: "users",
        typename: "Query",
      }

      expect(pathToString(path)).toBe("users")
    })

    it("should convert a multi-level path", () => {
      const path: ResponsePath = {
        prev: {
          prev: {
            prev: undefined,
            key: "users",
            typename: "Query",
          },
          key: 0,
          typename: "User",
        },
        key: "name",
        typename: "User",
      }

      expect(pathToString(path)).toBe("users.0.name")
    })

    it("should handle array indices in path", () => {
      const path: ResponsePath = {
        prev: {
          prev: undefined,
          key: "items",
          typename: "Query",
        },
        key: 5,
        typename: "Item",
      }

      expect(pathToString(path)).toBe("items.5")
    })
  })

  describe("getFieldDepth", () => {
    const createInfo = (path: ResponsePath): GraphQLResolveInfo => {
      return { path } as GraphQLResolveInfo
    }

    it("should return 0 for root fields", () => {
      const info = createInfo({
        prev: undefined,
        key: "users",
        typename: "Query",
      })

      expect(getFieldDepth(info)).toBe(0)
    })

    it("should return 1 for first-level nested fields", () => {
      const info = createInfo({
        prev: {
          prev: undefined,
          key: "users",
          typename: "Query",
        },
        key: "name",
        typename: "User",
      })

      expect(getFieldDepth(info)).toBe(1)
    })

    it("should not count array indices in depth", () => {
      const info = createInfo({
        prev: {
          prev: {
            prev: undefined,
            key: "users",
            typename: "Query",
          },
          key: 0, // Array index - should not count
          typename: "User",
        },
        key: "name",
        typename: "User",
      })

      expect(getFieldDepth(info)).toBe(1)
    })

    it("should count deeply nested fields", () => {
      const info = createInfo({
        prev: {
          prev: {
            prev: {
              prev: undefined,
              key: "users",
              typename: "Query",
            },
            key: "posts",
            typename: "User",
          },
          key: "author",
          typename: "Post",
        },
        key: "name",
        typename: "User",
      })

      expect(getFieldDepth(info)).toBe(3)
    })
  })

  describe("isIntrospectionField", () => {
    const createInfo = (fieldName: string): GraphQLResolveInfo => {
      return { fieldName } as GraphQLResolveInfo
    }

    it("should return true for __schema", () => {
      expect(isIntrospectionField(createInfo("__schema"))).toBe(true)
    })

    it("should return true for __type", () => {
      expect(isIntrospectionField(createInfo("__type"))).toBe(true)
    })

    it("should return true for __typename", () => {
      expect(isIntrospectionField(createInfo("__typename"))).toBe(true)
    })

    it("should return false for regular fields", () => {
      expect(isIntrospectionField(createInfo("users"))).toBe(false)
      expect(isIntrospectionField(createInfo("name"))).toBe(false)
      expect(isIntrospectionField(createInfo("id"))).toBe(false)
    })

    it("should return false for fields containing but not starting with __", () => {
      expect(isIntrospectionField(createInfo("user__id"))).toBe(false)
    })
  })
})
