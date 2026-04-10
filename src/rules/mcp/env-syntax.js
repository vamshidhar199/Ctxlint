// Rule: mcp-env-syntax
// Validates that env var references use the correct syntax for the config file's client.
//
// Different MCP clients use different env var interpolation syntax:
//   Claude Desktop / most clients:  "${VAR_NAME}"
//   VS Code:                        "${env:VAR_NAME}"
//   Windows environments:           "%VAR_NAME%"
//
// This rule flags values that look like env var references but use the wrong syntax
// for the detected client, and flags raw values that should be env var references.

const CLIENT_PATTERNS = {
  '.vscode/mcp.json': {
    name: 'VS Code',
    preferred: '${env:VAR_NAME}',
    valid: /^\$\{env:[A-Z_][A-Z0-9_]*\}$/,
    wrong: /^\$\{[A-Z_][A-Z0-9_]*\}$/,  // Claude-style in VS Code
    wrongMessage: 'VS Code uses `${env:VAR_NAME}` syntax, not `${VAR_NAME}`',
  },
};

// Looks like an env var reference but in wrong format
const ANY_ENV_REF = /^\$\{[^}]+\}$|^\$[A-Z_][A-Z0-9_]*$|^%[A-Z_][A-Z0-9_]*%$/;

export const mcpEnvSyntax = {
  name: 'mcp-env-syntax',
  severity: 'warn',
  description: 'Validates env var reference syntax matches the expected format for each MCP client',

  run(config, configName = '') {
    if (!config?.mcpServers) return [];
    const diagnostics = [];

    const clientRule = CLIENT_PATTERNS[configName];

    for (const [serverName, serverDef] of Object.entries(config.mcpServers)) {
      if (!serverDef?.env || typeof serverDef.env !== 'object') continue;

      for (const [envKey, envValue] of Object.entries(serverDef.env)) {
        if (typeof envValue !== 'string') continue;

        // Skip non-reference values (handled by hardcoded-secret rule)
        if (!ANY_ENV_REF.test(envValue) && !envValue.startsWith('$')) continue;

        // Client-specific syntax check
        if (clientRule && clientRule.wrong && clientRule.wrong.test(envValue)) {
          diagnostics.push({
            rule: 'mcp-env-syntax',
            severity: 'warn',
            server: serverName,
            field: `env.${envKey}`,
            message: `\`${serverName}.env.${envKey}\`: ${clientRule.wrongMessage}`,
            suggestion: `Change \`"${envKey}": "${envValue}"\` to \`"${envKey}": "\${env:${envKey}}"\``,
          });
        }
      }
    }

    return diagnostics;
  },
};
