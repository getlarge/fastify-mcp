import type { Tracer, SpanAttributes } from '@opentelemetry/api'

/**
 * MCP semantic convention attribute keys from @opentelemetry/semantic-conventions incubating.
 * Re-exported here so consumers don't need to depend on the semconv package directly.
 * Source: https://opentelemetry.io/docs/specs/semconv/registry/attributes/mcp/
 */
export const MCP_ATTR = {
  METHOD_NAME: 'mcp.method.name',
  SESSION_ID: 'mcp.session.id',
  PROTOCOL_VERSION: 'mcp.protocol.version',
  RESOURCE_URI: 'mcp.resource.uri',
  TOOL_NAME: 'mcp.tool.name'
} as const

/**
 * Lazily resolve MCP_ATTR from @opentelemetry/semantic-conventions/incubating when available,
 * falling back to local string constants. Both @opentelemetry/api and
 * @opentelemetry/semantic-conventions are optional peer dependencies — neither is imported
 * statically anywhere in this module.
 */
type AttrMap = { METHOD_NAME: string, SESSION_ID: string, PROTOCOL_VERSION: string, RESOURCE_URI: string, TOOL_NAME: string }

async function resolveAttrs (): Promise<AttrMap> {
  try {
    const semconv = await import('@opentelemetry/semantic-conventions/incubating')
    return {
      METHOD_NAME: semconv.ATTR_MCP_METHOD_NAME as string,
      SESSION_ID: semconv.ATTR_MCP_SESSION_ID as string,
      PROTOCOL_VERSION: semconv.ATTR_MCP_PROTOCOL_VERSION as string,
      RESOURCE_URI: semconv.ATTR_MCP_RESOURCE_URI as string,
      TOOL_NAME: MCP_ATTR.TOOL_NAME // not yet in semconv
    }
  } catch {
    return MCP_ATTR
  }
}

let resolvedAttrs: AttrMap | undefined

async function getAttrs (): Promise<AttrMap> {
  if (!resolvedAttrs) resolvedAttrs = await resolveAttrs()
  return resolvedAttrs
}

/**
 * Wraps `fn` in an active OTel span. If no tracer is provided, calls fn directly.
 * Both @opentelemetry/api and @opentelemetry/semantic-conventions are loaded dynamically —
 * neither is ever required for users who don't configure telemetry.
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
 * Build span attributes for an MCP operation, using resolved semconv keys.
 */
export async function buildSpanAttributes (
  methodName: string,
  sessionId?: string,
  extra?: Record<string, string>
): Promise<SpanAttributes> {
  const attr = await getAttrs()
  const attrs: SpanAttributes = {
    [attr.METHOD_NAME]: methodName
  }
  if (sessionId) attrs[attr.SESSION_ID] = sessionId
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      attrs[k] = v
    }
  }
  return attrs
}
