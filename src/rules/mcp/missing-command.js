// Rule: mcp-missing-command
// Every MCP server definition must have either a `command` (stdio transport)
// or a `url` (HTTP transport). Without one of these, the server can never start.

export const mcpMissingCommand = {
  name: 'mcp-missing-command',
  severity: 'error',
  description: 'Flags MCP server definitions with neither a command nor a url',

  run(config) {
    if (!config?.mcpServers) return [];
    const diagnostics = [];

    for (const [serverName, serverDef] of Object.entries(config.mcpServers)) {
      if (!serverDef || typeof serverDef !== 'object') {
        diagnostics.push({
          rule: 'mcp-missing-command',
          severity: 'error',
          server: serverName,
          field: null,
          message: `\`${serverName}\` is not a valid server definition (expected an object)`,
          suggestion: 'Each server must be an object with at least a `command` or `url` field.',
        });
        continue;
      }

      const hasCommand = typeof serverDef.command === 'string' && serverDef.command.trim().length > 0;
      const hasUrl = typeof serverDef.url === 'string' && serverDef.url.trim().length > 0;

      if (!hasCommand && !hasUrl) {
        diagnostics.push({
          rule: 'mcp-missing-command',
          severity: 'error',
          server: serverName,
          field: 'command',
          message: `\`${serverName}\` has no \`command\` or \`url\` — the server cannot start`,
          suggestion: 'Add `"command": "node"` with `"args": [...]` for a local server, or `"url": "https://..."` for an HTTP server.',
        });
      }
    }

    return diagnostics;
  },
};
