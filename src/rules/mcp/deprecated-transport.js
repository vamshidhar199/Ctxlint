// Rule: mcp-deprecated-transport
// The SSE transport (`"transport": "sse"`) was deprecated in MCP spec 2025-03-26.
// The replacement is the Streamable HTTP transport.

export const mcpDeprecatedTransport = {
  name: 'mcp-deprecated-transport',
  severity: 'warn',
  description: 'Flags deprecated SSE transport in MCP server definitions',

  run(config) {
    if (!config?.mcpServers) return [];
    const diagnostics = [];

    for (const [serverName, serverDef] of Object.entries(config.mcpServers)) {
      if (!serverDef) continue;

      // Top-level transport field
      if (typeof serverDef.transport === 'string' && serverDef.transport.toLowerCase() === 'sse') {
        diagnostics.push({
          rule: 'mcp-deprecated-transport',
          severity: 'warn',
          server: serverName,
          field: 'transport',
          message: `\`${serverName}.transport\` uses deprecated SSE transport`,
          suggestion: 'SSE was deprecated in MCP spec 2025-03-26. Switch to Streamable HTTP: remove the `transport` field (HTTP is now the default for URL-based servers).',
        });
      }

      // transport nested inside a transports array or object
      if (Array.isArray(serverDef.transports)) {
        for (const t of serverDef.transports) {
          if (typeof t === 'object' && t?.type?.toLowerCase() === 'sse') {
            diagnostics.push({
              rule: 'mcp-deprecated-transport',
              severity: 'warn',
              server: serverName,
              field: 'transports',
              message: `\`${serverName}.transports\` includes deprecated SSE type`,
              suggestion: 'Replace the SSE transport entry with `{ "type": "http" }` (Streamable HTTP).',
            });
            break;
          }
        }
      }
    }

    return diagnostics;
  },
};
