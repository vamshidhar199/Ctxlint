import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// MCP config file locations in priority order
const MCP_CONFIG_LOCATIONS = [
  '.mcp.json',
  '.cursor/mcp.json',
  '.vscode/mcp.json',
  '.amazonq/mcp.json',
];

export function detectMcpConfigs(projectDir) {
  const found = [];

  for (const relPath of MCP_CONFIG_LOCATIONS) {
    const fullPath = join(projectDir, relPath);
    if (existsSync(fullPath)) {
      try {
        const raw = readFileSync(fullPath, 'utf8');
        const parsed = JSON.parse(raw);
        found.push({ name: relPath, path: fullPath, parsed });
      } catch (err) {
        // Include it with a parse error so rules can report it
        found.push({ name: relPath, path: fullPath, parsed: null, parseError: err.message });
      }
    }
  }

  return found;
}
