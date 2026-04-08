import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import {
  PACKAGE_MANAGERS,
  PYTHON_MANAGERS,
  LANGUAGE_INDICATORS,
  LINTER_CONFIGS,
} from '../constants.js';

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', '.nuxt',
  '__pycache__', '.venv', 'venv', 'target', 'vendor',
  '.cache', 'coverage', '.turbo', '.vercel', '.output',
]);

const FRAMEWORK_MAP = {
  'react': 'React',
  'next': 'Next.js',
  'vue': 'Vue',
  'nuxt': 'Nuxt',
  'angular': 'Angular',
  '@angular/core': 'Angular',
  'express': 'Express',
  'fastify': 'Fastify',
  'hono': 'Hono',
  'prisma': 'Prisma',
  '@prisma/client': 'Prisma',
  'drizzle-orm': 'Drizzle',
  'tailwindcss': 'Tailwind CSS',
  'svelte': 'Svelte',
};

function walkDir(dir, projectDir, files, dirs, depth = 0) {
  if (depth > 5) return;
  if (files.size > 10000) return;

  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }

  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue;

    const fullPath = join(dir, entry);
    let stat;
    try {
      stat = statSync(fullPath);
    } catch {
      continue;
    }

    const relPath = relative(projectDir, fullPath).replace(/\\/g, '/');

    if (stat.isDirectory()) {
      dirs.add(relPath);
      walkDir(fullPath, projectDir, files, dirs, depth + 1);
    } else {
      files.add(relPath);
    }
  }
}

export function scanProject(projectDir) {
  const files = new Set();
  const dirs = new Set();

  walkDir(projectDir, projectDir, files, dirs);

  // Parse package.json
  let packageJson = null;
  let scripts = null;
  const pkgPath = join(projectDir, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      packageJson = JSON.parse(readFileSync(pkgPath, 'utf8'));
      scripts = packageJson.scripts || null;
    } catch {
      // ignore
    }
  }

  // Detect package manager
  let packageManager = null;
  for (const [lockfile, pm] of Object.entries(PACKAGE_MANAGERS)) {
    if (existsSync(join(projectDir, lockfile))) {
      packageManager = pm;
      break;
    }
  }

  // Detect python manager
  let pythonManager = null;
  for (const [lockfile, pm] of Object.entries(PYTHON_MANAGERS)) {
    if (existsSync(join(projectDir, lockfile))) {
      pythonManager = pm;
      break;
    }
  }

  // Detect languages
  const languages = [];
  for (const [indicator, lang] of Object.entries(LANGUAGE_INDICATORS)) {
    if (existsSync(join(projectDir, indicator)) && !languages.includes(lang)) {
      languages.push(lang);
    }
  }

  // Detect dependencies
  const dependencies = new Set();
  if (packageJson) {
    for (const dep of Object.keys(packageJson.dependencies || {})) dependencies.add(dep);
    for (const dep of Object.keys(packageJson.devDependencies || {})) dependencies.add(dep);
    for (const dep of Object.keys(packageJson.peerDependencies || {})) dependencies.add(dep);
  }

  // Detect frameworks from dependencies
  const frameworks = [];
  for (const [pkg, framework] of Object.entries(FRAMEWORK_MAP)) {
    if (dependencies.has(pkg) && !frameworks.includes(framework)) {
      frameworks.push(framework);
    }
  }

  // Detect linters
  const linterConfigs = [];
  for (const config of LINTER_CONFIGS) {
    if (existsSync(join(projectDir, config))) {
      linterConfigs.push(config);
    }
  }
  const hasLinter = linterConfigs.length > 0;

  // README
  let readme = null;
  const readmePath = join(projectDir, 'README.md');
  if (existsSync(readmePath)) {
    try {
      readme = readFileSync(readmePath, 'utf8');
    } catch {
      // ignore
    }
  }

  // Makefile targets
  let makefileTargets = null;
  const makefilePath = join(projectDir, 'Makefile');
  if (existsSync(makefilePath)) {
    try {
      const makefileContent = readFileSync(makefilePath, 'utf8');
      const targetRegex = /^([a-zA-Z_][\w-]*)\s*:/gm;
      makefileTargets = [];
      let m;
      while ((m = targetRegex.exec(makefileContent)) !== null) {
        makefileTargets.push(m[1]);
      }
    } catch {
      // ignore
    }
  }

  // Rust: detect Cargo.toml
  const hasCargo = existsSync(join(projectDir, 'Cargo.toml'));

  // Go: parse go.mod for module name
  let goModule = null;
  const goModPath = join(projectDir, 'go.mod');
  if (existsSync(goModPath)) {
    try {
      const goModContent = readFileSync(goModPath, 'utf8');
      const match = goModContent.match(/^module\s+(\S+)/m);
      if (match) goModule = match[1];
    } catch {
      // ignore
    }
  }

  // Python: parse pyproject.toml for scripts
  let pythonScripts = null;
  const pyprojectPath = join(projectDir, 'pyproject.toml');
  if (existsSync(pyprojectPath)) {
    try {
      const pyprojectContent = readFileSync(pyprojectPath, 'utf8');
      // Match [project.scripts] or [tool.poetry.scripts] sections
      const sectionMatch = pyprojectContent.match(/\[(?:project|tool\.poetry)\.scripts\]([\s\S]*?)(?=\n\[|\s*$)/);
      if (sectionMatch) {
        pythonScripts = {};
        for (const line of sectionMatch[1].split('\n')) {
          const m = line.match(/^([\w-]+)\s*=\s*"(.+)"/);
          if (m) pythonScripts[m[1]] = m[2];
        }
      }
    } catch {
      // ignore
    }
  }

  return {
    dir: projectDir,
    files,
    dirs,
    packageJson,
    scripts,
    dependencies,
    packageManager,
    pythonManager,
    languages,
    frameworks,
    hasLinter,
    linterConfigs,
    readme,
    makefileTargets,
    hasCargo,
    goModule,
    pythonScripts,
  };
}
