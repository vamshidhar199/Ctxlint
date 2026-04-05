import { isInCodeBlock } from '../parser/context-file.js';

// `npm run <script>` or `pnpm run <script>` etc.
const NPM_RUN_PATTERN = /`(npm|yarn|pnpm|bun)\s+run\s+([\w:.-]+)`/g;
// `pnpm <script>` or `yarn <script>` or `bun <script>` (without "run")
const PM_DIRECT_SCRIPT_PATTERN = /`(pnpm|yarn|bun)\s+([\w:.-]+)`/g;
const MAKE_TARGET_PATTERN = /`make\s+([\w.-]+)`/g;
const GENERIC_CMD_PATTERN = /(?:^|\n)\s*(?:\$|>)\s*((?:npm|yarn|pnpm|bun|pip|uv|cargo|go|make|gradle|mvn)\s+.+)/gm;

// These are built-in package manager commands (not script names)
const BUILTIN_COMMANDS = new Set([
  'install', 'add', 'remove', 'uninstall', 'update', 'upgrade',
  'init', 'create', 'publish', 'link', 'unlink', 'pack',
  'audit', 'fund', 'outdated', 'dedupe', 'prune',
  'store', 'cache', 'config', 'info', 'list', 'ls',
  'exec', 'dlx', 'x', 'why', 'doctor',
]);

export const staleCommand = {
  name: 'stale-command',
  severity: 'error',
  description: 'Flags build commands that do not match package.json scripts or Makefile targets',

  run(parsedFile, projectData) {
    const diagnostics = [];
    const { lines, codeBlocks } = parsedFile;
    const scripts = projectData.scripts || {};
    const scriptNames = new Set(Object.keys(scripts));

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (isInCodeBlock(i, codeBlocks)) continue;

      let m;

      // Check `pm run <script>`
      NPM_RUN_PATTERN.lastIndex = 0;
      while ((m = NPM_RUN_PATTERN.exec(line)) !== null) {
        const pm = m[1];
        const scriptName = m[2];
        if (!scriptNames.has(scriptName)) {
          const available = [...scriptNames].join(', ');
          diagnostics.push({
            rule: 'stale-command',
            severity: 'error',
            line: i + 1,
            endLine: null,
            message: `\`${pm} run ${scriptName}\` — script "${scriptName}" does not exist in package.json`,
            suggestion: available
              ? `Available scripts: ${available}`
              : 'No scripts defined in package.json',
          });
        }
      }

      // Check `pnpm/yarn/bun <script>` (without "run") — these PMs support it
      PM_DIRECT_SCRIPT_PATTERN.lastIndex = 0;
      while ((m = PM_DIRECT_SCRIPT_PATTERN.exec(line)) !== null) {
        const pm = m[1];
        const cmd = m[2];
        // Skip built-in PM commands
        if (BUILTIN_COMMANDS.has(cmd)) continue;
        if (!scriptNames.has(cmd)) {
          const available = [...scriptNames].join(', ');
          diagnostics.push({
            rule: 'stale-command',
            severity: 'error',
            line: i + 1,
            endLine: null,
            message: `\`${pm} ${cmd}\` — script "${cmd}" does not exist in package.json`,
            suggestion: available
              ? `Available scripts: ${available}`
              : 'No scripts defined in package.json',
          });
        }
      }

      // Check make targets
      if (projectData.makefileTargets) {
        const makeTargets = new Set(projectData.makefileTargets);
        MAKE_TARGET_PATTERN.lastIndex = 0;
        while ((m = MAKE_TARGET_PATTERN.exec(line)) !== null) {
          const target = m[1];
          if (!makeTargets.has(target)) {
            diagnostics.push({
              rule: 'stale-command',
              severity: 'error',
              line: i + 1,
              endLine: null,
              message: `\`make ${target}\` — target "${target}" does not exist in Makefile`,
              suggestion: `Available targets: ${[...makeTargets].join(', ')}`,
            });
          }
        }
      }
    }

    // Package manager mismatch check
    const content = lines.join('\n');
    const pmMentions = {
      npm: /\bnpm\s+(run|install|test|build|start|dev)\b/g,
      yarn: /\byarn\s+(run|add|install|test|build|start|dev)\b/g,
      pnpm: /\bpnpm\s+(run|add|install|test|build|start|dev)\b/g,
      bun: /\bbun\s+(run|add|install|test|build|start|dev)\b/g,
    };

    if (projectData.packageManager) {
      for (const [pm, pattern] of Object.entries(pmMentions)) {
        if (pm !== projectData.packageManager && pattern.test(content)) {
          // Find the line
          for (let i = 0; i < lines.length; i++) {
            pattern.lastIndex = 0;
            if (pattern.test(lines[i]) && !isInCodeBlock(i, codeBlocks)) {
              diagnostics.push({
                rule: 'stale-command',
                severity: 'warn',
                line: i + 1,
                endLine: null,
                message: `context references \`${pm}\` but project uses \`${projectData.packageManager}\``,
                suggestion: `Update commands to use \`${projectData.packageManager}\` (detected from lockfile)`,
              });
              break;
            }
          }
        }
      }
    }

    return diagnostics;
  },
};
