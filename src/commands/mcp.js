import { resolve } from 'path';
import { detectMcpConfigs } from '../detector/mcp.js';
import { mcpRules } from '../rules/mcp/index.js';
import { reportMcpTerminal, reportMcpJson } from '../reporter/mcp-terminal.js';

const SEVERITY_RANK = { info: 0, warn: 1, error: 2 };

export async function mcp(projectDir, options = {}) {
  const { format = 'terminal', severity = 'info' } = options;
  const absDir = resolve(projectDir);
  const minSeverity = SEVERITY_RANK[severity] ?? 0;

  // 1. Detect MCP config files
  const configs = detectMcpConfigs(absDir);

  if (configs.length === 0) {
    if (format === 'json') {
      console.log(JSON.stringify({ configs: [], summary: { total: 0 } }));
    } else {
      console.log('\nNo MCP config files found (.mcp.json, .cursor/mcp.json, .vscode/mcp.json).');
      console.log('Create a .mcp.json file to define your MCP servers.\n');
    }
    return 0;
  }

  let hasErrors = false;

  // 2. Lint each config file
  for (const configFile of configs) {
    // Parse error — can't run rules, just report it
    if (configFile.parseError) {
      if (format === 'json') {
        reportMcpJson([], configFile.name, configFile.parseError);
      } else {
        reportMcpTerminal([], configFile.name, configFile.parseError);
      }
      hasErrors = true;
      continue;
    }

    // Run all MCP rules (pass configName for client-specific checks)
    const diagnostics = [];
    for (const rule of mcpRules) {
      try {
        const results = rule.run(configFile.parsed, configFile.name);
        diagnostics.push(...results);
      } catch (err) {
        console.error(`MCP rule ${rule.name} threw an error: ${err.message}`);
      }
    }

    // Filter by severity
    const filtered = diagnostics.filter(
      d => SEVERITY_RANK[d.severity] >= minSeverity
    );

    if (filtered.some(d => d.severity === 'error')) hasErrors = true;

    if (format === 'json') {
      reportMcpJson(filtered, configFile.name, null);
    } else {
      reportMcpTerminal(filtered, configFile.name, null);
    }
  }

  return hasErrors ? 1 : 0;
}
