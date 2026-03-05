/**
 * MCP semantic convention attribute keys.
 * Source: https://opentelemetry.io/docs/specs/semconv/registry/attributes/mcp/
 *
 * Kept in a separate module with no @opentelemetry/api dependency so they can be
 * imported statically by any module without pulling in OTel at runtime.
 */
export const MCP_ATTR = {
  METHOD_NAME: 'mcp.method.name',
  SESSION_ID: 'mcp.session.id',
  PROTOCOL_VERSION: 'mcp.protocol.version',
  RESOURCE_URI: 'mcp.resource.uri',
  TOOL_NAME: 'mcp.tool.name',
  PROMPT_NAME: 'mcp.prompt.name'
} as const

/**
 * Build span attributes for an MCP operation using semconv keys.
 */
export function buildSpanAttributes (
  methodName: string,
  sessionId?: string,
  extra?: Record<string, string>
): Record<string, string> {
  return {
    [MCP_ATTR.METHOD_NAME]: methodName,
    ...(sessionId ? { [MCP_ATTR.SESSION_ID]: sessionId } : {}),
    ...extra
  }
}
