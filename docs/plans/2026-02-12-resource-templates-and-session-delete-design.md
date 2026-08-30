# Resource Templates & Session DELETE

## Resource Templates (`resources/templates/list`)

Parameterized resources (URIs containing RFC 6570 `{...}` syntax) are currently only discoverable via `resources/list`, which is incorrect per the MCP spec. Template resources should be served via `resources/templates/list`.

### Approach

Infer template vs concrete from the URI at query time using `/\{[^}]+\}/`. No new registration API needed.

- `resources/list` — filters out template URIs
- `resources/templates/list` — filters in template URIs, maps to `ResourceTemplate` shape (`uri` -> `uriTemplate`)
- `resources/read` — no changes (already handles URI template resolution)
- Handler switch — add `case 'resources/templates/list'`

### Risk

Subtle breaking change: template resources move from `resources/list` to `resources/templates/list`. This is the correct MCP behavior.

## Session DELETE

Add `DELETE` route at the MCP endpoint for explicit session termination per the MCP transport spec.

### Behavior

1. Read `mcp-session-id` from headers
2. 400 if missing
3. 404 if session not found
4. Delete session from store
5. Force-close active SSE stream (`response.raw.end()`)
6. Unsubscribe from message broker
7. Return 204

Route is only registered when `enableSSE: true`.

## Testing

### Resource Templates

- `resources/list` excludes template resources
- `resources/templates/list` returns correct `ResourceTemplate` shape
- Pagination cursor support
- `resources/read` still works for templates
- Mixed concrete + template resources split correctly

### Session DELETE

- 204 on success
- 400 when header missing
- 404 when session not found
- SSE stream closed after DELETE
- Session removed from store
- Route not registered when SSE disabled
- Redis backend cross-instance deletion
