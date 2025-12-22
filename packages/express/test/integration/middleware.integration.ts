import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { startTestServer, executeQuery, getGraphiQL } from "../helpers/test-utils"

describe("Express Middleware Integration", () => {
  let port: number
  let stop: () => Promise<void>

  beforeAll(async () => {
    const server = await startTestServer()
    port = server.port
    stop = server.stop
  })

  afterAll(async () => {
    await stop()
  })

  // ==========================================================================
  // Queries
  // ==========================================================================
  describe("queries", () => {
    it("should execute a simple query", async () => {
      const result = await executeQuery(port, "{ hello }")
      expect(result).toEqual({ data: { hello: "world" } })
    })

    it("should execute a query with arguments", async () => {
      const result = await executeQuery(port, '{ echo(message: "test message") }')
      expect(result).toEqual({ data: { echo: "test message" } })
    })

    it("should execute a query with variables", async () => {
      const result = await executeQuery(
        port,
        "query Echo($msg: String!) { echo(message: $msg) }",
        { msg: "hello from variables" }
      )
      expect(result).toEqual({ data: { echo: "hello from variables" } })
    })

    it("should handle invalid queries", async () => {
      const result = await executeQuery(port, "{ nonExistentField }")
      expect(result.errors).toBeDefined()
      expect(result.errors!.length).toBeGreaterThan(0)
    })
  })

  // ==========================================================================
  // Mutations
  // ==========================================================================
  describe("mutations", () => {
    it("should execute a simple mutation", async () => {
      const result = await executeQuery(
        port,
        'mutation { createUser(name: "Alice") { id name } }'
      )
      expect(result).toEqual({
        data: {
          createUser: { id: "1", name: "Alice" },
        },
      })
    })

    it("should execute a mutation with variables", async () => {
      const result = await executeQuery(
        port,
        "mutation CreateUser($name: String!) { createUser(name: $name) { id name } }",
        { name: "Bob" }
      )
      expect(result).toEqual({
        data: {
          createUser: { id: "1", name: "Bob" },
        },
      })
    })
  })

  // ==========================================================================
  // Nested Queries
  // ==========================================================================
  describe("nested queries", () => {
    it("should resolve nested object fields", async () => {
      const result = await executeQuery(
        port,
        '{ user(id: "123") { id name posts { id title } } }'
      )
      expect(result.data).toBeDefined()
      const data = result.data as { user: { id: string; name: string; posts: unknown[] } }
      expect(data.user.id).toBe("123")
      expect(data.user.name).toBe("Test User")
      expect(data.user.posts).toHaveLength(2)
    })

    it("should handle partial selection on nested fields", async () => {
      const result = await executeQuery(
        port,
        '{ user(id: "456") { name posts { title } } }'
      )
      expect(result.data).toBeDefined()
      const data = result.data as { user: { name: string; posts: { title: string }[] } }
      expect(data.user.name).toBe("Test User")
      expect(data.user.posts[0].title).toBe("First Post")
    })
  })

  // ==========================================================================
  // Directives
  // ==========================================================================
  describe("directives", () => {
    it("should apply directive transformers to field results", async () => {
      const result = await executeQuery(port, "{ greeting }")
      expect(result).toEqual({ data: { greeting: "HELLO" } })
    })
  })

  // ==========================================================================
  // Subscriptions
  // ==========================================================================
  describe.skip("subscriptions", () => {
    // WebSocket subscription tests would go here
    // These require WebSocket support in the server which may need to be implemented
    it("should stream subscription events", async () => {
      // TODO: Implement WebSocket subscription testing
    })
  })

  // ==========================================================================
  // GraphiQL
  // ==========================================================================
  describe("GraphiQL", () => {
    it("should serve GraphiQL interface", async () => {
      const result = await getGraphiQL(port)
      expect(result.status).toBe(200)
      expect(result.body).toContain("GraphiQL")
    })

    it("should include the correct GraphQL endpoint in GraphiQL", async () => {
      const result = await getGraphiQL(port)
      expect(result.body).toContain("/graphql")
    })
  })

  // ==========================================================================
  // Error Handling
  // ==========================================================================
  describe("error handling", () => {
    it("should return proper error format for syntax errors", async () => {
      const result = await executeQuery(port, "{ invalid syntax")
      expect(result.errors).toBeDefined()
      expect(result.errors!.length).toBeGreaterThan(0)
    })

    it("should return proper error format for validation errors", async () => {
      const result = await executeQuery(port, '{ user(wrongArg: "test") { id } }')
      expect(result.errors).toBeDefined()
    })
  })

  // ==========================================================================
  // Express-specific Tests
  // ==========================================================================
  describe("Express-specific behavior", () => {
    it("should handle concurrent requests", async () => {
      const queries = Array.from({ length: 10 }, (_, i) =>
        executeQuery(port, `{ echo(message: "request-${i}") }`)
      )
      const results = await Promise.all(queries)
      results.forEach((result, i) => {
        expect(result).toEqual({ data: { echo: `request-${i}` } })
      })
    })
  })
})
