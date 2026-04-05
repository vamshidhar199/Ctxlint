import { readFileSync, writeFileSync, copyFileSync } from 'fs';
import { dirname, basename, resolve } from 'path';
import { scanProject } from '../detector/project.js';
import { parseContextFile } from '../parser/context-file.js';
import { rules } from '../rules/index.js';
import { tokenBudget } from '../rules/token-budget.js';
import { THRESHOLDS, ANSI } from '../constants.js';

function buildSlimmed(lines, errorRanges) {
  // Mark lines to remove (0-indexed)
  const toRemove = new Set();
  for (const { start, end } of errorRanges) {
    for (let i = start; i <= end; i++) {
      toRemove.add(i);
    }
  }

  const kept = lines.filter((_, i) => !toRemove.has(i));

  // Collapse 3+ consecutive blank lines into 2
  const result = [];
  let blankRun = 0;
  for (const line of kept) {
    if (line.trim() === '') {
      blankRun++;
      if (blankRun <= 2) result.push(line);
    } else {
      blankRun = 0;
      result.push(line);
    }
  }

  return result.join('\n');
}

export async function slim(filePath, options = {}) {
  const { dryRun = false, backup = false } = options;
  const absFile = resolve(filePath);

  let content;
  try {
    content = readFileSync(absFile, 'utf8');
  } catch (err) {
    console.error(`Cannot read file: ${err.message}`);
    return 2;
  }

  const projectDir = dirname(absFile);
  let projectData;
  try {
    projectData = scanProject(projectDir);
  } catch (err) {
    console.error(`Error scanning project: ${err.message}`);
    return 2;
  }

  const parsed = parseContextFile(content);
  const lines = parsed.lines;

  // Run all non-budget rules
  const otherDiagnostics = [];
  const nonBudgetRules = rules.filter(r => r.name !== 'token-budget');
  for (const rule of nonBudgetRules) {
    try {
      otherDiagnostics.push(...rule.run(parsed, projectData));
    } catch (err) {
      // skip rule errors
    }
  }

  // Run token-budget last
  let budgetDiags = [];
  try {
    budgetDiags = tokenBudget.run(parsed, projectData, otherDiagnostics);
  } catch (err) {
    // skip
  }

  const allDiagnostics = [...otherDiagnostics, ...budgetDiags];

  // Collect error-severity line ranges (0-indexed)
  const errorRanges = [];
  for (const d of allDiagnostics) {
    if (d.severity === 'error') {
      errorRanges.push({
        start: (d.line || 1) - 1,
        end: d.endLine != null ? d.endLine - 1 : (d.line || 1) - 1,
      });
    }
  }

  if (errorRanges.length === 0) {
    console.log(`${ANSI.GREEN}✓${ANSI.RESET} No error-severity issues found. Nothing to remove.`);
    console.log(`  Run \`ctxlint check ${basename(absFile)}\` for all diagnostics.`);
    return 0;
  }

  const slimmedContent = buildSlimmed(lines, errorRanges);
  const slimmedLines = slimmedContent.split('\n');

  const removedLines = lines.length - slimmedLines.length;
  const originalTokens = Math.round(content.length * THRESHOLDS.TOKENS_PER_CHAR);
  const slimmedTokens = Math.round(slimmedContent.length * THRESHOLDS.TOKENS_PER_CHAR);
  const savedTokens = originalTokens - slimmedTokens;

  if (dryRun) {
    // Show a diff-style preview
    console.log(`${ANSI.BOLD}--- ${basename(absFile)} (original: ${lines.length} lines, ~${originalTokens} tokens)${ANSI.RESET}`);
    console.log(`${ANSI.BOLD}+++ ${basename(absFile)} (slimmed: ${slimmedLines.length} lines, ~${slimmedTokens} tokens)${ANSI.RESET}`);
    console.log('');

    const toRemove = new Set();
    for (const { start, end } of errorRanges) {
      for (let i = start; i <= end; i++) toRemove.add(i);
    }

    for (let i = 0; i < lines.length; i++) {
      if (toRemove.has(i)) {
        console.log(`${ANSI.RED}- ${lines[i]}${ANSI.RESET}`);
      } else {
        console.log(`  ${lines[i]}`);
      }
    }

    console.log('');
    console.log(`${ANSI.BOLD}Summary (dry run):${ANSI.RESET}`);
    console.log(`  Lines removed:   ${removedLines} (${lines.length} → ${slimmedLines.length})`);
    console.log(`  Tokens saved:    ~${savedTokens} (~${originalTokens} → ~${slimmedTokens})`);
    console.log(`  Issues removed:  ${errorRanges.length} error-severity`);
  } else {
    if (backup) {
      const bakPath = absFile + '.bak';
      copyFileSync(absFile, bakPath);
      console.log(`Backup saved: ${bakPath}`);
    }

    writeFileSync(absFile, slimmedContent, 'utf8');

    console.log(`${ANSI.GREEN}✓${ANSI.RESET} Slimmed ${basename(absFile)}`);
    console.log(`  Lines removed:   ${removedLines} (${lines.length} → ${slimmedLines.length})`);
    console.log(`  Tokens saved:    ~${savedTokens} (~${originalTokens} → ~${slimmedTokens})`);
    console.log(`  Issues removed:  ${errorRanges.length} error-severity`);
  }

  return 0;
}
