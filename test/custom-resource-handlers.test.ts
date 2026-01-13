import { test, describe } from 'node:test'
import type { TestContext } from 'node:test'
import Fastify from 'fastify'
import mcpPlugin from '../src/index.ts'
import type {
  JSONRPCRequest,
  JSONRPCResponse,
  JSONRPCError,
  ListResourcesResult,
  ReadResourceResult
} from '../src/schema.ts'
import { JSONRPC_VERSION, INVALID_PARAMS } from '../src/schema.ts'

describe('Custom Resource Handlers', () => {
  describe('mcpSetResourcesListHandler', () => {
    test('should use custom handler for resources/list', async (t: TestContext) => {
      const app = Fastify()
      t.after(() => app.close())

      await app.register(mcpPlugin)
      await app.ready()

      // Set custom handler that returns dynamic resources
      app.mcpSetResourcesListHandler(async (params, _context) => {
        return {
          resources: [
            { uri: 'dynamic://resource1', name: 'Dynamic Resource 1' },
            { uri: 'dynamic://resource2', name: 'Dynamic Resource 2' }
          ],
          nextCursor: params.cursor ? undefined : 'next-page'
        }
      })

      const request: JSONRPCRequest = {
        jsonrpc: JSONRPC_VERSION,
        id: 1,
        method: 'resources/list'
      }

      const response = await app.inject({
        method: 'POST',
        url: '/mcp',
        payload: request
      })

      t.assert.strictEqual(response.statusCode, 200)
      const body = response.json() as JSONRPCResponse
      const result = body.result as ListResourcesResult
      t.assert.strictEqual(result.resources.length, 2)
      t.assert.strictEqual(result.resources[0].uri, 'dynamic://resource1')
      t.assert.strictEqual(result.resources[1].uri, 'dynamic://resource2')
      t.assert.strictEqual(result.nextCursor, 'next-page')
    })

    test('should fall back to default when custom handler returns null', async (t: TestContext) => {
      const app = Fastify()
      t.after(() => app.close())

      await app.register(mcpPlugin)
      await app.ready()

      // Add a static resource
      app.mcpAddResource({
        uri: 'static://resource',
        name: 'Static Resource'
      })

      // Set custom handler that returns null to fall back
      app.mcpSetResourcesListHandler(async () => {
        return null
      })

      const request: JSONRPCRequest = {
        jsonrpc: JSONRPC_VERSION,
        id: 1,
        method: 'resources/list'
      }

      const response = await app.inject({
        method: 'POST',
        url: '/mcp',
        payload: request
      })

      t.assert.strictEqual(response.statusCode, 200)
      const body = response.json() as JSONRPCResponse
      const result = body.result as ListResourcesResult
      t.assert.strictEqual(result.resources.length, 1)
      t.assert.strictEqual(result.resources[0].uri, 'static://resource')
    })

    test('should fall back to default when custom handler throws', async (t: TestContext) => {
      const app = Fastify({ logger: false })
      t.after(() => app.close())

      await app.register(mcpPlugin)
      await app.ready()

      // Add a static resource
      app.mcpAddResource({
        uri: 'static://resource',
        name: 'Static Resource'
      })

      // Set custom handler that throws
      app.mcpSetResourcesListHandler(async () => {
        throw new Error('Custom handler error')
      })

      const request: JSONRPCRequest = {
        jsonrpc: JSONRPC_VERSION,
        id: 1,
        method: 'resources/list'
      }

      const response = await app.inject({
        method: 'POST',
        url: '/mcp',
        payload: request
      })

      t.assert.strictEqual(response.statusCode, 200)
      const body = response.json() as JSONRPCResponse
      const result = body.result as ListResourcesResult
      t.assert.strictEqual(result.resources.length, 1)
      t.assert.strictEqual(result.resources[0].uri, 'static://resource')
    })
  })

  describe('mcpSetResourcesReadHandler', () => {
    test('should use custom handler for resources/read', async (t: TestContext) => {
      const app = Fastify()
      t.after(() => app.close())

      await app.register(mcpPlugin)
      await app.ready()

      // Set custom handler
      app.mcpSetResourcesReadHandler(async (uri, _context) => {
        if (uri.startsWith('custom://')) {
          return {
            contents: [{
              uri,
              text: `Custom content for ${uri}`,
              mimeType: 'text/plain'
            }]
          }
        }
        return null // Fall back to registered resources
      })

      const request: JSONRPCRequest = {
        jsonrpc: JSONRPC_VERSION,
        id: 1,
        method: 'resources/read',
        params: { uri: 'custom://my-resource' }
      }

      const response = await app.inject({
        method: 'POST',
        url: '/mcp',
        payload: request
      })

      t.assert.strictEqual(response.statusCode, 200)
      const body = response.json() as JSONRPCResponse
      const result = body.result as ReadResourceResult
      t.assert.strictEqual(result.contents[0].uri, 'custom://my-resource')
      const content = result.contents[0] as { text: string }
      t.assert.strictEqual(content.text, 'Custom content for custom://my-resource')
    })

    test('should fall back to registered resources when custom handler returns null', async (t: TestContext) => {
      const app = Fastify()
      t.after(() => app.close())

      await app.register(mcpPlugin)
      await app.ready()

      // Add a registered resource
      app.mcpAddResource({
        uri: 'items://123',
        name: 'Item 123'
      }, async (uri) => {
        return {
          contents: [{
            uri,
            text: `Registered resource: ${uri}`,
            mimeType: 'text/plain'
          }]
        }
      })

      // Custom handler returns null for non-custom URIs
      app.mcpSetResourcesReadHandler(async (uri) => {
        if (uri.startsWith('custom://')) {
          return { contents: [{ uri, text: 'custom' }] }
        }
        return null
      })

      const request: JSONRPCRequest = {
        jsonrpc: JSONRPC_VERSION,
        id: 1,
        method: 'resources/read',
        params: { uri: 'items://123' }
      }

      const response = await app.inject({
        method: 'POST',
        url: '/mcp',
        payload: request
      })

      t.assert.strictEqual(response.statusCode, 200)
      const body = response.json() as JSONRPCResponse
      const result = body.result as ReadResourceResult
      t.assert.strictEqual(result.contents[0].uri, 'items://123')
      const content = result.contents[0] as { text: string }
      t.assert.strictEqual(content.text, 'Registered resource: items://123')
    })

    test('should implement pattern matching in custom handler', async (t: TestContext) => {
      const app = Fastify()
      t.after(() => app.close())

      await app.register(mcpPlugin)
      await app.ready()

      // Custom handler with pattern matching for users URIs
      app.mcpSetResourcesReadHandler(async (uri) => {
        const userMatch = uri.match(/^users:\/\/([^/]+)\/profile$/)
        if (userMatch) {
          const userId = userMatch[1]
          return {
            contents: [{
              uri,
              text: JSON.stringify({ userId, type: 'profile' }),
              mimeType: 'application/json'
            }]
          }
        }
        return null
      })

      const request: JSONRPCRequest = {
        jsonrpc: JSONRPC_VERSION,
        id: 1,
        method: 'resources/read',
        params: { uri: 'users://user-456/profile' }
      }

      const response = await app.inject({
        method: 'POST',
        url: '/mcp',
        payload: request
      })

      t.assert.strictEqual(response.statusCode, 200)
      const body = response.json() as JSONRPCResponse
      const result = body.result as ReadResourceResult
      t.assert.strictEqual(result.contents[0].uri, 'users://user-456/profile')
      const content = result.contents[0] as { text: string }
      const data = JSON.parse(content.text)
      t.assert.strictEqual(data.userId, 'user-456')
    })
  })

  describe('resources/templates/list', () => {
    test('should return templates from custom handler', async (t: TestContext) => {
      const app = Fastify()
      t.after(() => app.close())

      await app.register(mcpPlugin)
      await app.ready()

      app.mcpSetResourcesTemplatesListHandler(async () => {
        return {
          resourceTemplates: [
            { uriTemplate: 'custom://{type}/{id}', name: 'Custom Template' }
          ]
        }
      })

      const request: JSONRPCRequest = {
        jsonrpc: JSONRPC_VERSION,
        id: 1,
        method: 'resources/templates/list'
      }

      const response = await app.inject({
        method: 'POST',
        url: '/mcp',
        payload: request
      })

      t.assert.strictEqual(response.statusCode, 200)
      const body = response.json() as JSONRPCResponse
      const result = body.result as { resourceTemplates: Array<{ uriTemplate: string, name: string }> }
      t.assert.strictEqual(result.resourceTemplates.length, 1)
      t.assert.strictEqual(result.resourceTemplates[0].uriTemplate, 'custom://{type}/{id}')
    })

    test('should extract templates from registered resources with patterns', async (t: TestContext) => {
      const app = Fastify()
      t.after(() => app.close())

      await app.register(mcpPlugin)
      await app.ready()

      // Add resources with patterns (uriPattern contains {param})
      app.mcpAddResource({
        uriPattern: 'items://{itemId}',
        name: 'Item',
        description: 'An item resource'
      })

      app.mcpAddResource({
        uriPattern: 'users://{userId}/settings',
        name: 'User Settings',
        mimeType: 'application/json'
      })

      // Add a static resource (should not be in templates)
      app.mcpAddResource({
        uri: 'config://app',
        name: 'App Config'
      })

      const request: JSONRPCRequest = {
        jsonrpc: JSONRPC_VERSION,
        id: 1,
        method: 'resources/templates/list'
      }

      const response = await app.inject({
        method: 'POST',
        url: '/mcp',
        payload: request
      })

      t.assert.strictEqual(response.statusCode, 200)
      const body = response.json() as JSONRPCResponse
      const result = body.result as { resourceTemplates: Array<{ uriTemplate: string, name: string }> }
      t.assert.strictEqual(result.resourceTemplates.length, 2)

      const templates = result.resourceTemplates.map(tmpl => tmpl.uriTemplate).sort()
      t.assert.deepStrictEqual(templates, ['items://{itemId}', 'users://{userId}/settings'])
    })
  })

  describe('resources/subscribe and resources/unsubscribe', () => {
    test('should require session ID for subscription', async (t: TestContext) => {
      const app = Fastify()
      t.after(() => app.close())

      await app.register(mcpPlugin)
      await app.ready()

      const request: JSONRPCRequest = {
        jsonrpc: JSONRPC_VERSION,
        id: 1,
        method: 'resources/subscribe',
        params: { uri: 'test://resource' }
      }

      const response = await app.inject({
        method: 'POST',
        url: '/mcp',
        payload: request
      })

      t.assert.strictEqual(response.statusCode, 200)
      const body = response.json() as JSONRPCError
      t.assert.strictEqual(body.error.code, INVALID_PARAMS)
      t.assert.ok(body.error.message.includes('Session ID required'))
    })

    test('should require uri parameter', async (t: TestContext) => {
      const app = Fastify()
      t.after(() => app.close())

      await app.register(mcpPlugin)
      await app.ready()

      const request: JSONRPCRequest = {
        jsonrpc: JSONRPC_VERSION,
        id: 1,
        method: 'resources/subscribe',
        params: {}
      }

      const response = await app.inject({
        method: 'POST',
        url: '/mcp',
        payload: request
      })

      t.assert.strictEqual(response.statusCode, 200)
      const body = response.json() as JSONRPCError
      t.assert.strictEqual(body.error.code, INVALID_PARAMS)
      t.assert.ok(body.error.message.includes('Missing uri parameter'))
    })

    test('should require uri parameter for unsubscribe', async (t: TestContext) => {
      const app = Fastify()
      t.after(() => app.close())

      await app.register(mcpPlugin)
      await app.ready()

      const request: JSONRPCRequest = {
        jsonrpc: JSONRPC_VERSION,
        id: 1,
        method: 'resources/unsubscribe',
        params: {}
      }

      const response = await app.inject({
        method: 'POST',
        url: '/mcp',
        payload: request
      })

      t.assert.strictEqual(response.statusCode, 200)
      const body = response.json() as JSONRPCError
      t.assert.strictEqual(body.error.code, INVALID_PARAMS)
      t.assert.ok(body.error.message.includes('Missing uri parameter'))
    })

    test('should subscribe and unsubscribe with valid session', async (t: TestContext) => {
      const app = Fastify()
      t.after(() => app.close())

      await app.register(mcpPlugin, { enableSSE: true })
      await app.ready()

      // First create a session via SSE GET
      const sseResponse = await app.inject({
        method: 'GET',
        url: '/mcp',
        headers: { accept: 'text/event-stream' },
        payloadAsStream: true
      })

      const sessionId = sseResponse.headers['mcp-session-id'] as string
      t.assert.ok(sessionId, 'Session ID should be returned')

      // Clean up SSE stream
      sseResponse.stream().destroy()

      // Subscribe to a resource
      const subscribeRequest: JSONRPCRequest = {
        jsonrpc: JSONRPC_VERSION,
        id: 1,
        method: 'resources/subscribe',
        params: { uri: 'test://resource' }
      }

      const subscribeResponse = await app.inject({
        method: 'POST',
        url: '/mcp',
        headers: { 'mcp-session-id': sessionId },
        payload: subscribeRequest
      })

      t.assert.strictEqual(subscribeResponse.statusCode, 200)
      const subscribeBody = subscribeResponse.json() as JSONRPCResponse
      t.assert.deepStrictEqual(subscribeBody.result, {})

      // Verify subscription exists
      const subscriptions = await app.mcpGetResourceSubscriptions()
      t.assert.ok(subscriptions.has(sessionId))
      t.assert.ok(subscriptions.get(sessionId)?.has('test://resource'))

      // Unsubscribe
      const unsubscribeRequest: JSONRPCRequest = {
        jsonrpc: JSONRPC_VERSION,
        id: 2,
        method: 'resources/unsubscribe',
        params: { uri: 'test://resource' }
      }

      const unsubscribeResponse = await app.inject({
        method: 'POST',
        url: '/mcp',
        headers: { 'mcp-session-id': sessionId },
        payload: unsubscribeRequest
      })

      t.assert.strictEqual(unsubscribeResponse.statusCode, 200)
      const unsubscribeBody = unsubscribeResponse.json() as JSONRPCResponse
      t.assert.deepStrictEqual(unsubscribeBody.result, {})

      // Verify subscription removed
      const updatedSubscriptions = await app.mcpGetResourceSubscriptions()
      const sessionSubs = updatedSubscriptions.get(sessionId)
      t.assert.ok(!sessionSubs || !sessionSubs.has('test://resource'))
    })
  })

  describe('mcpGetResourceSubscriptions', () => {
    test('should return subscription store', async (t: TestContext) => {
      const app = Fastify()
      t.after(() => app.close())

      await app.register(mcpPlugin)
      await app.ready()

      const subscriptions = await app.mcpGetResourceSubscriptions()
      t.assert.ok(subscriptions instanceof Map)
    })
  })
})
