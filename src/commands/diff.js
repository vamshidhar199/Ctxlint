import { readFileSync, statSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { execSync } from 'child_process';
import { detectContextFiles } from '../detector/context-file.js';
import { scanProject } from '../detector/project.js';
import { ANSI } from '../constants.js';

// Same patterns as stale-file-ref to extract file references
const PRIMARY_PATTERN = /`([^`\s]+\.[a-zA-Z]{1,10})`/g;
const DIR_PATTERN = /`([^`\s]+\/)`/g;

function extractFileRefs(content) {
  const refs = new Set();
  const lines = content.split('\n');
  for (const line of lines) {
    let m;
    PRIMARY_PATTERN.lastIndex = 0;
    while ((m = PRIMARY_PATTERN.exec(line)) !== null) {
      const p = m[1].replace(/^\.\//, '');
      if (!p.startsWith('http') && !p.includes('*')) refs.add(p);
    }
    DIR_PATTERN.lastIndex = 0;
    while ((m = DIR_PATTERN.exec(line)) !== null) {
      const p = m[1].replace(/^\.\//, '');
      if (!p.startsWith('http') && !p.includes('*')) refs.add(p);
    }
  }
  return refs;
}

function runGit(cmd, cwd) {
  try {
    return execSync(cmd, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

function daysDiff(dateStr) {
  try {
    const then = new Date(dateStr);
    const now = new Date();
    return Math.floor((now - then) / (1000 * 60 * 60 * 24));
  } catch {
    return null;
  }
}

export async function diff(projectDir, options = {}) {
  const { since = null, failOnStale = false } = options;
  const absDir = resolve(projectDir);

  const contextFiles = detectContextFiles(absDir);
  if (contextFiles.length === 0) {
    console.log('No context file found. Run `ctxlint init` to create one.');
    return 0;
  }

  const projectData = scanProject(absDir);
  let hasStale = false;

  for (const contextFile of contextFiles) {
    console.log(`\n${ANSI.BOLD}${contextFile.name}${ANSI.RESET}`);

    // Determine baseline
    let baseline = since;
    let baselineDays = null;

    if (!baseline) {
      // Try git log for the file's last commit
      const gitDate = runGit(`git log -1 --format=%aI -- ${contextFile.name}`, absDir);
      if (gitDate) {
        baseline = gitDate;
        baselineDays = daysDiff(gitDate);
      } else {
        // Fallback: filesystem mtime
        try {
          const stat = statSync(contextFile.path);
          baseline = stat.mtime.toISOString();
          baselineDays = daysDiff(baseline);
        } catch {
          baseline = null;
        }
      }
    } else {
      baselineDays = daysDiff(baseline);
    }

    if (baselineDays !== null) {
      console.log(`  Last updated: ${baselineDays} day${baselineDays !== 1 ? 's' : ''} ago`);
    }

    // Find changed files since baseline
    let changedFiles = new Set();
    let deletedFiles = new Set();
    if (baseline) {
      const gitOut = runGit(`git diff --name-only --diff-filter=DR "${baseline}..HEAD"`, absDir);
      if (gitOut) {
        for (const f of gitOut.split('\n').filter(Boolean)) {
          deletedFiles.add(f);
        }
      }
      const gitModified = runGit(`git diff --name-only --diff-filter=ADMR "${baseline}..HEAD"`, absDir);
      if (gitModified) {
        for (const f of gitModified.split('\n').filter(Boolean)) {
          changedFiles.add(f);
        }
      }
    }

    // Extract references from context file
    const refs = extractFileRefs(contextFile.content);

    const staleItems = [];

    // Check file refs
    for (const ref of refs) {
      const normalRef = ref.endsWith('/') ? ref.slice(0, -1) : ref;
      if (deletedFiles.has(normalRef) || deletedFiles.has(ref)) {
        staleItems.push({ ref, reason: 'deleted or renamed since baseline' });
      }
    }

    // Check package.json scripts changes
    if (baseline && existsSync(join(absDir, 'package.json'))) {
      const oldPkgJson = runGit(`git show "${baseline}:package.json"`, absDir);
      if (oldPkgJson) {
        try {
          const oldScripts = JSON.parse(oldPkgJson).scripts || {};
          const newScripts = projectData.scripts || {};

          // Extract script names mentioned in context file
          const scriptPattern = /`(?:npm|yarn|pnpm|bun)\s+(?:run\s+)?([\w:.-]+)`/g;
          let m;
          while ((m = scriptPattern.exec(contextFile.content)) !== null) {
            const scriptName = m[1];
            if (oldScripts[scriptName] && !newScripts[scriptName]) {
              staleItems.push({ ref: scriptName, reason: `script removed from package.json` });
            }
          }
        } catch {
          // ignore parse errors
        }
      }
    }

    if (staleItems.length === 0) {
      console.log(`  ${ANSI.GREEN}✓ No drift detected${ANSI.RESET}`);
    } else {
      hasStale = true;
      console.log(`  ${ANSI.YELLOW}⚠ ${staleItems.length} stale reference${staleItems.length !== 1 ? 's' : ''}:${ANSI.RESET}`);
      for (const item of staleItems) {
        console.log(`    ${ANSI.RED}✗${ANSI.RESET} \`${item.ref}\` — ${item.reason}`);
      }
    }
  }

  console.log('');

  if (failOnStale && hasStale) return 1;
  return 0;
}
