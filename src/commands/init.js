import { writeFileSync, existsSync, symlinkSync } from 'fs';
import { join, dirname } from 'path';
import { resolve } from 'path';
import { scanProject } from '../detector/project.js';
import { detectContextFiles } from '../detector/context-file.js';

const TEST_FRAMEWORKS = {
  'vitest': 'vitest',
  'jest': 'jest',
  'mocha': 'mocha',
  'jasmine': 'jasmine',
  'ava': 'ava',
  'pytest': 'pytest',
};

function detectTestFramework(dependencies) {
  for (const [pkg, name] of Object.entries(TEST_FRAMEWORKS)) {
    if (dependencies.has(pkg)) return name;
  }
  return null;
}

function describeScript(name) {
  const lower = name.toLowerCase();
  if (lower === 'dev' || lower === 'start') return 'Dev';
  if (lower === 'build') return 'Build';
  if (lower === 'test') return 'Test';
  if (lower.startsWith('test')) return 'Test';
  if (lower === 'lint') return 'Lint';
  if (lower.startsWith('lint')) return 'Lint';
  if (lower === 'typecheck' || lower === 'type-check') return 'Type check';
  if (lower === 'format') return 'Format';
  if (lower === 'preview') return 'Preview';
  if (lower.includes('migrate')) return 'DB migrate';
  if (lower.includes('seed')) return 'DB seed';
  if (lower.includes('deploy')) return 'Deploy';
  return null;
}

export function generateContent(projectData, format = 'agents') {
  const fileName = format === 'claude' ? 'CLAUDE.md' : format === 'gemini' ? 'GEMINI.md' : 'AGENTS.md';
  const lines = [`# ${fileName}`, ''];

  const pm = projectData.packageManager || 'npm';
  const testFramework = detectTestFramework(projectData.dependencies);
  const scripts = projectData.scripts || {};
  const scriptEntries = Object.entries(scripts);

  if (scriptEntries.length > 0 || (projectData.makefileTargets && projectData.makefileTargets.length > 0)) {
    lines.push('## Build & test');
    for (const [name] of scriptEntries) {
      const desc = describeScript(name);
      const suffix = name === 'test' && testFramework ? ` (${testFramework})` : '';
      if (desc) {
        lines.push(`- ${desc}: \`${pm} ${name}\`${suffix}`);
      } else {
        lines.push(`- \`${pm} ${name}\`${suffix}`);
      }
    }
    if (projectData.makefileTargets) {
      for (const target of projectData.makefileTargets) {
        lines.push(`- \`make ${target}\``);
      }
    }
    lines.push('');
  }

  // Non-obvious patterns — only add section if there's something non-obvious
  const nonObvious = [];

  if (projectData.packageJson && projectData.packageJson.workspaces) {
    const ws = projectData.packageJson.workspaces;
    const wsStr = Array.isArray(ws) ? ws.join(', ') : JSON.stringify(ws);
    nonObvious.push(`- Monorepo with workspaces: ${wsStr}`);
  }

  if (projectData.files.has('.env.example')) {
    nonObvious.push('- Copy `.env.example` to `.env` before running. Required env vars documented there.');
  }

  if (projectData.packageJson) {
    const main = projectData.packageJson.main;
    if (main && main !== 'index.js' && main !== './index.js' && main !== 'src/index.js') {
      nonObvious.push(`- Custom entry point: \`${main}\``);
    }
  }

  if (nonObvious.length > 0) {
    lines.push('## Non-obvious patterns');
    lines.push(...nonObvious);
    lines.push('');
  }

  // Constraints
  const constraints = [];

  if (projectData.files.has('.nvmrc')) {
    constraints.push('- Node version pinned in `.nvmrc`');
  } else if (projectData.files.has('.node-version')) {
    constraints.push('- Node version pinned in `.node-version`');
  }

  if (projectData.files.has('.python-version')) {
    constraints.push('- Python version pinned in `.python-version`');
  }

  if (projectData.packageJson && projectData.packageJson.engines) {
    for (const [runtime, version] of Object.entries(projectData.packageJson.engines)) {
      constraints.push(`- ${runtime} ${version} required (engines field)`);
    }
  }

  if (projectData.packageJson && projectData.packageJson.packageManager) {
    const pmField = projectData.packageJson.packageManager;
    constraints.push(`- ${pmField} only (corepack enforced)`);
  }

  if (constraints.length > 0) {
    lines.push('## Constraints');
    lines.push(...constraints);
    lines.push('');
  }

  // Trim trailing blank lines
  while (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }

  return lines.join('\n') + '\n';
}

function getOutputFileName(format) {
  switch (format) {
    case 'claude': return 'CLAUDE.md';
    case 'gemini': return 'GEMINI.md';
    default: return 'AGENTS.md';
  }
}

export async function init(projectDir, options = {}) {
  const { format = 'agents', dryRun = false, force = false } = options;
  const absDir = resolve(projectDir);

  let projectData;
  try {
    projectData = scanProject(absDir);
  } catch (err) {
    console.error(`Error scanning project: ${err.message}`);
    return 2;
  }

  // Check for existing context files
  if (!force) {
    const existing = detectContextFiles(absDir);
    if (existing.length > 0) {
      const names = existing.map(f => f.name).join(', ');
      console.error(`Context file(s) already exist: ${names}`);
      console.error('Use --force to overwrite.');
      return 1;
    }
  }

  const formats = format === 'all' ? ['agents', 'claude', 'gemini'] : [format];

  for (const fmt of formats) {
    const content = generateContent(projectData, fmt);
    const fileName = getOutputFileName(fmt);

    if (dryRun) {
      if (formats.length > 1) console.log(`--- ${fileName} ---`);
      process.stdout.write(content);
    } else {
      const filePath = join(absDir, fileName);
      writeFileSync(filePath, content, 'utf8');
      const lineCount = content.split('\n').filter(l => l.trim()).length;
      console.log(`Created ${fileName} (${lineCount} non-empty lines)`);
    }
  }

  return 0;
}
