import type { Tracer, SpanAttributes } from '@opentelemetry/api'

/**
 * MCP semantic convention attribute keys from @opentelemetry/semantic-conventions/incubating.
 * Kept as local constants so call sites don't need to import from semconv directly.
 */
export const MCP_ATTR = {
  METHOD_NAME: 'mcp.method.name',
  SESSION_ID: 'mcp.session.id',
  PROTOCOL_VERSION: 'mcp.protocol.version',
  RESOURCE_URI: 'mcp.resource.uri',
  TOOL_NAME: 'mcp.tool.name'
} as const

/**
 * Wraps `fn` in an active OTel span. If no tracer is provided, calls fn directly.
 * @opentelemetry/api is loaded dynamically so it is never required at runtime
 * for users who don't configure telemetry.
 */
export async function withSpan<T> (
  tracer: Tracer | undefined,
  spanName: string,
  attributes: SpanAttributes,
  fn: () => Promise<T>
): Promise<T> {
  if (!tracer) return fn()

  const { SpanStatusCode } = await import('@opentelemetry/api')

  return tracer.startActiveSpan(spanName, { attributes }, async (span) => {
    try {
      const result = await fn()
      span.setStatus({ code: SpanStatusCode.OK })
      return result
    } catch (err: any) {
      span.recordException(err)
      span.setStatus({ code: SpanStatusCode.ERROR, message: err?.message ?? String(err) })
      throw err
    } finally {
      span.end()
    }
  })
}

/**
 * Build span attributes for an MCP operation using semconv keys.
 */
export function buildSpanAttributes (
  methodName: string,
  sessionId?: string,
  extra?: Record<string, string>
): SpanAttributes {
  const attrs: SpanAttributes = {
    [MCP_ATTR.METHOD_NAME]: methodName
  }
  if (sessionId) attrs[MCP_ATTR.SESSION_ID] = sessionId
  if (extra) Object.assign(attrs, extra)
  return attrs
}
