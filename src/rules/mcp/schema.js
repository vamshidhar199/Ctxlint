// Rule: mcp-schema
// Validates that the config has a valid `mcpServers` root key with at least one entry.

export const mcpSchema = {
  name: 'mcp-schema',
  severity: 'error',
  description: 'MCP config must have a valid `mcpServers` root key',

  run(config) {
    if (config === null) return []; // parse errors handled separately

    const diagnostics = [];

    if (typeof config !== 'object' || Array.isArray(config)) {
      diagnostics.push({
        rule: 'mcp-schema',
        severity: 'error',
        server: null,
        field: null,
        message: 'Config root must be a JSON object',
        suggestion: 'Wrap your server definitions in `{ "mcpServers": { ... } }`',
      });
      return diagnostics;
    }

    if (!config.mcpServers) {
      diagnostics.push({
        rule: 'mcp-schema',
        severity: 'error',
        server: null,
        field: 'mcpServers',
        message: 'Missing required root key `mcpServers`',
        suggestion: 'Add `"mcpServers": {}` as the root key. All server definitions go inside it.',
      });
      return diagnostics;
    }

    if (typeof config.mcpServers !== 'object' || Array.isArray(config.mcpServers)) {
      diagnostics.push({
        rule: 'mcp-schema',
        severity: 'error',
        server: null,
        field: 'mcpServers',
        message: '`mcpServers` must be an object, not an array',
        suggestion: 'Use `"mcpServers": { "server-name": { ... } }` format.',
      });
    }

    return diagnostics;
  },
};
