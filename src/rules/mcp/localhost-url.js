// Rule: mcp-localhost-url
// Flags `url` fields pointing to localhost or 127.0.0.1.
// These only work on the developer's own machine — they break in CI, teammates' machines,
// and any remote environment.

const LOCALHOST_PATTERN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i;

export const mcpLocalhostUrl = {
  name: 'mcp-localhost-url',
  severity: 'warn',
  description: 'Flags MCP server URLs pointing to localhost — these only work on one machine',

  run(config) {
    if (!config?.mcpServers) return [];
    const diagnostics = [];

    for (const [serverName, serverDef] of Object.entries(config.mcpServers)) {
      if (!serverDef?.url) continue;

      if (LOCALHOST_PATTERN.test(serverDef.url)) {
        diagnostics.push({
          rule: 'mcp-localhost-url',
          severity: 'warn',
          server: serverName,
          field: 'url',
          message: `\`${serverName}.url\` points to localhost (\`${serverDef.url}\`)`,
          suggestion: 'Localhost URLs only work on your machine. Use an environment variable for the host: "${MCP_SERVER_URL}" or document that this server must be run locally.',
        });
      }
    }

    return diagnostics;
  },
};
