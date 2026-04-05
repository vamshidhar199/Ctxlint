import { resolve } from 'path';
import { detectContextFiles } from '../detector/context-file.js';
import { scanProject } from '../detector/project.js';
import { parseContextFile } from '../parser/context-file.js';
import { rules } from '../rules/index.js';
import { tokenBudget } from '../rules/token-budget.js';
import { reportTerminal } from '../reporter/terminal.js';
import { reportJson } from '../reporter/json.js';
import { SEVERITY } from '../constants.js';

const SEVERITY_RANK = { info: 0, warn: 1, error: 2 };

export async function check(projectDir, options = {}) {
  const { format = 'terminal', severity = 'info' } = options;
  const absDir = resolve(projectDir);
  const minSeverity = SEVERITY_RANK[severity] ?? 0;

  // 1. Detect context files
  let contextFiles;
  try {
    contextFiles = detectContextFiles(absDir);
  } catch (err) {
    console.error(`Error scanning directory: ${err.message}`);
    return 2;
  }

  if (contextFiles.length === 0) {
    if (format === 'json') {
      console.log(JSON.stringify({ file: null, diagnostics: [], summary: { errors: 0, warnings: 0, info: 0 } }));
    } else {
      console.log('No context file found (AGENTS.md, CLAUDE.md, GEMINI.md, .cursorrules).');
      console.log('Run `ctxlint init` to generate a minimal one.');
    }
    return 0;
  }

  // 2. Scan project metadata
  let projectData;
  try {
    projectData = scanProject(absDir);
  } catch (err) {
    console.error(`Error scanning project: ${err.message}`);
    return 2;
  }

  let hasErrors = false;

  // 3. Lint each context file
  for (const contextFile of contextFiles) {
    const parsed = parseContextFile(contextFile.content);
    const otherDiagnostics = [];

    // Run all rules except token-budget first
    const nonBudgetRules = rules.filter(r => r.name !== 'token-budget');
    for (const rule of nonBudgetRules) {
      try {
        const results = rule.run(parsed, projectData);
        otherDiagnostics.push(...results);
      } catch (err) {
        console.error(`Rule ${rule.name} threw an error: ${err.message}`);
      }
    }

    // Run token-budget last, passing all other diagnostics
    let budgetDiagnostics = [];
    try {
      budgetDiagnostics = tokenBudget.run(parsed, projectData, otherDiagnostics);
    } catch (err) {
      console.error(`Rule token-budget threw an error: ${err.message}`);
    }

    const allDiagnostics = [...otherDiagnostics, ...budgetDiagnostics];

    // Filter by severity
    const filtered = allDiagnostics.filter(
      d => SEVERITY_RANK[d.severity] >= minSeverity
    );

    if (filtered.some(d => d.severity === 'error')) {
      hasErrors = true;
    }

    // Report
    if (format === 'json') {
      reportJson(filtered, contextFile.name, parsed);
    } else {
      reportTerminal(filtered, contextFile.name);
    }
  }

  return hasErrors ? 1 : 0;
}
