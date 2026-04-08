import { isInCodeBlock } from '../parser/context-file.js';

// `npm run <script>` or `pnpm run <script>` etc.
const NPM_RUN_PATTERN = /`(npm|yarn|pnpm|bun)\s+run\s+([\w:.-]+)`/g;
// `pnpm <script>` or `yarn <script>` or `bun <script>` (without "run")
const PM_DIRECT_SCRIPT_PATTERN = /`(pnpm|yarn|bun)\s+([\w:.-]+)`/g;
const MAKE_TARGET_PATTERN = /`make\s+([\w.-]+)`/g;
const GENERIC_CMD_PATTERN = /(?:^|\n)\s*(?:\$|>)\s*((?:npm|yarn|pnpm|bun|pip|uv|cargo|go|make|gradle|mvn)\s+.+)/gm;

// Non-JS ecosystem patterns
const CARGO_CMD_PATTERN = /`cargo\s+([\w:.-]+)/g;
const GO_CMD_PATTERN = /`go\s+(build|test|run|vet|generate|mod|fmt|install)\b/g;
const PYTHON_CMD_PATTERNS = [
  /`uv\s+run\b/g,
  /`poetry\s+run\b/g,
  /`pytest\b/g,
  /`python\s+-m\s+pytest\b/g,
  /`pipenv\s+run\b/g,
];

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

    // Non-JS ecosystem validation
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (isInCodeBlock(i, codeBlocks)) continue;

      // Cargo commands — only valid if Cargo.toml exists
      if (!projectData.hasCargo) {
        CARGO_CMD_PATTERN.lastIndex = 0;
        if (CARGO_CMD_PATTERN.test(line)) {
          diagnostics.push({
            rule: 'stale-command',
            severity: 'error',
            line: i + 1,
            endLine: null,
            message: '`cargo` command referenced but no `Cargo.toml` found in project root',
            suggestion: 'Remove this command or add a Cargo.toml if this is a Rust project.',
          });
        }
      }

      // Go commands — only valid if go.mod exists
      if (!projectData.goModule) {
        GO_CMD_PATTERN.lastIndex = 0;
        if (GO_CMD_PATTERN.test(line)) {
          diagnostics.push({
            rule: 'stale-command',
            severity: 'error',
            line: i + 1,
            endLine: null,
            message: '`go` command referenced but no `go.mod` found in project root',
            suggestion: 'Remove this command or add a go.mod if this is a Go project.',
          });
        }
      }

      // Python commands — only valid if a Python manager is detected
      if (!projectData.pythonManager) {
        for (const pattern of PYTHON_CMD_PATTERNS) {
          pattern.lastIndex = 0;
          if (pattern.test(line)) {
            diagnostics.push({
              rule: 'stale-command',
              severity: 'error',
              line: i + 1,
              endLine: null,
              message: 'Python command referenced but no Python project files found (uv.lock, poetry.lock, requirements.txt, etc.)',
              suggestion: 'Remove this command or ensure the project has a recognised Python dependency file.',
            });
            break; // one diagnostic per line
          }
        }
      }
    }

    return diagnostics;
  },
};
