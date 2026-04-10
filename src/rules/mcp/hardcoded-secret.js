// Rule: mcp-hardcoded-secret
// Flags hardcoded API keys and tokens in MCP server `env` blocks.
// Values that are env var references ($VAR, ${VAR}, %VAR%) are safe and ignored.

// Value patterns that look like real secrets
const SECRET_VALUE_PATTERNS = [
  /^sk-[a-zA-Z0-9]{20,}/,          // OpenAI / Anthropic style keys
  /^sk-ant-[a-zA-Z0-9-]{20,}/,     // Anthropic API key
  /^ghp_[a-zA-Z0-9]{36}/,          // GitHub personal access token
  /^ghs_[a-zA-Z0-9]{36}/,          // GitHub OAuth token
  /^xoxb-[0-9]+-/,                  // Slack bot token
  /^xoxp-[0-9]+-/,                  // Slack user token
  /^AIza[0-9A-Za-z_-]{35}/,        // Google API key
  /^AKIA[0-9A-Z]{16}/,             // AWS access key ID
  /^ya29\.[0-9A-Za-z_-]+/,         // Google OAuth access token
];

// Key names that strongly suggest a secret value
const SECRET_KEY_PATTERNS = [
  /api[_-]?key/i,
  /api[_-]?secret/i,
  /access[_-]?token/i,
  /auth[_-]?token/i,
  /private[_-]?key/i,
  /secret[_-]?key/i,
  /client[_-]?secret/i,
  /password/i,
  /bearer/i,
];

function isEnvVarReference(value) {
  // Safe patterns: ${VAR}, $VAR, %VAR%, {{VAR}}
  return (
    /^\$\{[^}]+\}$/.test(value) ||
    /^\$[A-Z_][A-Z0-9_]*$/.test(value) ||
    /^%[A-Z_][A-Z0-9_]*%$/.test(value) ||
    /^\{\{[^}]+\}\}$/.test(value)
  );
}

function looksLikeSecret(key, value) {
  if (typeof value !== 'string' || value.length < 8) return false;
  if (isEnvVarReference(value)) return false;

  // Matches a known secret value pattern
  if (SECRET_VALUE_PATTERNS.some(p => p.test(value))) return true;

  // Key name suggests a secret AND value is not obviously a placeholder
  const keyLooksSecret = SECRET_KEY_PATTERNS.some(p => p.test(key));
  const valueLooksPlaceholder = /^(your[-_]?|<|INSERT|REPLACE|xxx|TODO|CHANGEME)/i.test(value);
  if (keyLooksSecret && !valueLooksPlaceholder && value.length >= 16) return true;

  return false;
}

export const mcpHardcodedSecret = {
  name: 'mcp-hardcoded-secret',
  severity: 'error',
  description: 'Flags hardcoded API keys and tokens in MCP server env blocks',

  run(config) {
    if (!config?.mcpServers) return [];
    const diagnostics = [];

    for (const [serverName, serverDef] of Object.entries(config.mcpServers)) {
      if (!serverDef?.env || typeof serverDef.env !== 'object') continue;

      for (const [envKey, envValue] of Object.entries(serverDef.env)) {
        if (looksLikeSecret(envKey, envValue)) {
          diagnostics.push({
            rule: 'mcp-hardcoded-secret',
            severity: 'error',
            server: serverName,
            field: `env.${envKey}`,
            message: `\`${serverName}.env.${envKey}\` appears to contain a hardcoded secret`,
            suggestion: `Use an environment variable reference instead: "${envKey}": "\${${envKey}}"`,
          });
        }
      }
    }

    return diagnostics;
  },
};
