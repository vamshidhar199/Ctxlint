import { resolve } from 'path';
import { watch, readFileSync, existsSync } from 'fs';
import { detectContextFiles } from '../detector/context-file.js';
import { scanProject } from '../detector/project.js';
import { parseContextFile } from '../parser/context-file.js';
import { rules } from '../rules/index.js';
import { tokenBudget } from '../rules/token-budget.js';
import { reportTerminal } from '../reporter/terminal.js';
import { reportJson } from '../reporter/json.js';
import { reportSarif, flushSarif } from '../reporter/sarif.js';
import { ANSI } from '../constants.js';
import { loadConfig } from '../config.js';

const SEVERITY_RANK = { info: 0, warn: 1, error: 2 };

// Core lint logic — runs once and returns exit code
async function runLint(absDir, format, minSeverity, cfg) {
  // 1. Detect context files
  let contextFiles;
  try {
    contextFiles = detectContextFiles(absDir);
  } catch (err) {
    console.error(`Error scanning directory: ${err.message}`);
    return { code: 2, contextFilePaths: [] };
  }

  // Add any custom context files from .ctxlintrc
  if (cfg.contextFiles && cfg.contextFiles.length > 0) {
    for (const customPath of cfg.contextFiles) {
      const fullPath = resolve(absDir, customPath);
      if (existsSync(fullPath)) {
        const already = contextFiles.some(f => f.path === fullPath);
        if (!already) {
          contextFiles.push({
            name: customPath,
            path: fullPath,
            content: readFileSync(fullPath, 'utf8'),
          });
        }
      }
    }
  }

  if (contextFiles.length === 0) {
    if (format === 'json') {
      console.log(JSON.stringify({ file: null, diagnostics: [], summary: { errors: 0, warnings: 0, info: 0 } }));
    } else {
      console.log('No context file found (AGENTS.md, CLAUDE.md, GEMINI.md, .cursorrules).');
      console.log('Run `ctxlint init` to generate a minimal one.');
    }
    return { code: 0, contextFilePaths: [] };
  }

  // 2. Scan project metadata
  let projectData;
  try {
    projectData = scanProject(absDir);
  } catch (err) {
    console.error(`Error scanning project: ${err.message}`);
    return { code: 2, contextFilePaths: [] };
  }

  let hasErrors = false;
  let hasWarnings = false;

  // 3. Lint each context file
  for (const contextFile of contextFiles) {
    const parsed = parseContextFile(contextFile.content);
    const otherDiagnostics = [];

    // Apply checks/ignore filters from config
    const activeRules = rules.filter(r => {
      if (r.name === 'token-budget') return false;
      if (cfg.ignore.includes(r.name)) return false;
      if (cfg.checks && !cfg.checks.includes(r.name)) return false;
      return true;
    });

    for (const rule of activeRules) {
      try {
        const results = rule.run(parsed, projectData);
        otherDiagnostics.push(...results);
      } catch (err) {
        console.error(`Rule ${rule.name} threw an error: ${err.message}`);
      }
    }

    // token-budget: run unless explicitly ignored or excluded
    let budgetDiagnostics = [];
    const budgetIgnored = cfg.ignore.includes('token-budget') ||
      (cfg.checks && !cfg.checks.includes('token-budget'));
    if (!budgetIgnored) {
      try {
        budgetDiagnostics = tokenBudget.run(parsed, projectData, otherDiagnostics);
      } catch (err) {
        console.error(`Rule token-budget threw an error: ${err.message}`);
      }
    }

    const allDiagnostics = [...otherDiagnostics, ...budgetDiagnostics];
    const filtered = allDiagnostics.filter(d => SEVERITY_RANK[d.severity] >= minSeverity);

    if (filtered.some(d => d.severity === 'error')) hasErrors = true;
    if (filtered.some(d => d.severity === 'warn')) hasWarnings = true;

    if (format === 'json') {
      reportJson(filtered, contextFile.name, parsed);
    } else if (format === 'sarif') {
      reportSarif(filtered, contextFile.name, contextFile.path);
    } else {
      reportTerminal(filtered, contextFile.name);
    }
  }

  if (format === 'sarif') flushSarif();

  // --strict: exit 1 on warnings too
  const shouldFail = hasErrors || (cfg.strict && hasWarnings);

  return {
    code: shouldFail ? 1 : 0,
    contextFilePaths: contextFiles.map(f => f.path),
  };
}

export async function check(projectDir, options = {}) {
  const { format = 'terminal', severity = 'info', watchMode = false, strict = false } = options;
  const absDir = resolve(projectDir);
  const minSeverity = SEVERITY_RANK[severity] ?? 0;

  // Load .ctxlintrc — CLI flags override config file
  const cfg = loadConfig(absDir);
  if (strict) cfg.strict = true;

  if (watchMode) {
    if (format !== 'terminal') {
      console.error('--watch only works with terminal format. Switching to terminal.');
    }
    return startWatchMode(absDir, minSeverity, cfg);
  }

  const { code } = await runLint(absDir, format, minSeverity, cfg);
  return code;
}

async function startWatchMode(absDir, minSeverity, cfg) {
  const CLEAR = '\x1b[2J\x1b[0f';

  const printHeader = () => {
    const time = new Date().toLocaleTimeString();
    console.log(`${ANSI.BOLD}ctxlint --watch${ANSI.RESET}  ${ANSI.GRAY}${time} — watching for changes. Ctrl+C to stop.${ANSI.RESET}\n`);
  };

  // Initial run
  process.stdout.write(CLEAR);
  printHeader();
  const initial = await runLint(absDir, 'terminal', minSeverity, cfg);
  let watchedPaths = initial.contextFilePaths;

  if (watchedPaths.length === 0) {
    console.log(`${ANSI.GRAY}No context files found. Watching directory for new files...${ANSI.RESET}`);
  } else {
    console.log(`${ANSI.GRAY}Watching: ${watchedPaths.join(', ')}${ANSI.RESET}`);
  }

  // Debounce timer
  let debounceTimer = null;

  const rerun = async () => {
    process.stdout.write(CLEAR);
    printHeader();
    const result = await runLint(absDir, 'terminal', minSeverity, cfg);
    watchedPaths = result.contextFilePaths;
    if (watchedPaths.length > 0) {
      console.log(`${ANSI.GRAY}Watching: ${watchedPaths.join(', ')}${ANSI.RESET}`);
    }
  };

  const triggerRerun = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(rerun, 300);
  };

  // Watch the project directory for context file changes
  const watcher = watch(absDir, { persistent: true }, (eventType, filename) => {
    if (!filename) return;
    // Only react to known context file names or already-watched files
    const isContextFile = [
      'AGENTS.md', 'CLAUDE.md', 'GEMINI.md', '.cursorrules',
      '.github/copilot-instructions.md',
    ].some(name => filename === name || filename.endsWith(name));

    if (isContextFile) triggerRerun();
  });

  // Ctrl+C — clean exit
  process.on('SIGINT', () => {
    watcher.close();
    console.log(`\n${ANSI.GRAY}Watch stopped.${ANSI.RESET}`);
    process.exit(0);
  });

  // Keep process alive
  return new Promise(() => {});
}
