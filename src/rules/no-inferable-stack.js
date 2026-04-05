import { isInCodeBlock } from '../parser/context-file.js';

const STACK_PATTERNS = [
  /built\s+with\s+(.+)/i,
  /tech(nology)?\s+stack\s*[:=-]?/i,   // heading or inline "tech stack"
  /this\s+(is\s+a|project\s+is\s+a?)\s+\w+\s+(project|app|application|service|api)/i,
  /we\s+use\s+(React|Vue|Angular|Next|Express|Django|Flask|Rails|Spring)/i,
  /uses?\s+(TypeScript|JavaScript|Python|Go|Rust|Ruby|Java|Kotlin)/i,
  /database:\s*(PostgreSQL|MySQL|MongoDB|Redis|SQLite)/i,
  /written\s+in\s+(TypeScript|JavaScript|Python|Go|Rust)/i,
];

// Phrases that indicate a "why" or non-obvious explanation — do not flag
const EXCEPTION_PATTERNS = [
  /because/i,
  /due\s+to/i,
  /\breason\b/i,
  /unlike/i,
  /instead\s+of/i,
  /not\s+the\s+usual/i,
  /version/i,
  /\d+\+/,
];

// Map of tech name variants to what they might appear as in deps/languages/frameworks
const TECH_ALIASES = {
  typescript: ['TypeScript', 'typescript'],
  javascript: ['JavaScript', 'javascript'],
  react: ['React', 'react'],
  'next.js': ['Next.js', 'next'],
  next: ['Next.js', 'next'],
  vue: ['Vue', 'vue'],
  angular: ['Angular', 'angular', '@angular/core'],
  express: ['Express', 'express'],
  prisma: ['Prisma', 'prisma', '@prisma/client'],
  tailwind: ['Tailwind CSS', 'tailwindcss'],
  'tailwind css': ['Tailwind CSS', 'tailwindcss'],
  postgresql: ['PostgreSQL'],
  python: ['Python', 'python'],
  go: ['Go'],
  rust: ['Rust'],
  ruby: ['Ruby'],
  java: ['Java'],
  kotlin: ['Kotlin'],
};

function buildInferableSet(projectData) {
  const inferable = new Set();

  for (const lang of projectData.languages) {
    inferable.add(lang.toLowerCase());
  }
  for (const fw of projectData.frameworks) {
    inferable.add(fw.toLowerCase());
  }
  for (const dep of projectData.dependencies) {
    inferable.add(dep.toLowerCase());
  }

  return inferable;
}

function isTechInferable(techName, inferableSet) {
  const lower = techName.toLowerCase();
  if (inferableSet.has(lower)) return true;

  // Check aliases
  const aliases = TECH_ALIASES[lower];
  if (aliases) {
    for (const alias of aliases) {
      if (inferableSet.has(alias.toLowerCase())) return true;
    }
  }

  // Check if any dep starts with or contains the tech name
  for (const item of inferableSet) {
    if (item.includes(lower) || lower.includes(item)) return true;
  }

  return false;
}

// Extract technology names mentioned in matched text
function extractTechs(line) {
  const techs = [];
  const techPattern = /\b(TypeScript|JavaScript|React|Vue|Angular|Next\.?js?|Express|Django|Flask|Rails|Spring|Prisma|Tailwind\s*CSS|PostgreSQL|MySQL|MongoDB|Redis|SQLite|Drizzle|Hono|Fastify|Svelte|Nuxt|Python|Go|Rust|Ruby|Java|Kotlin|Vitest|Vite)\b/gi;
  let m;
  while ((m = techPattern.exec(line)) !== null) {
    techs.push(m[1]);
  }
  return techs;
}

function detectSource(tech, projectData) {
  const lower = tech.toLowerCase();
  for (const dep of projectData.dependencies) {
    if (dep.toLowerCase().includes(lower) || lower.includes(dep.toLowerCase())) {
      return 'package.json dependencies';
    }
  }
  for (const lang of projectData.languages) {
    if (lang.toLowerCase() === lower) return 'file extensions / config files';
  }
  for (const fw of projectData.frameworks) {
    if (fw.toLowerCase() === lower || fw.toLowerCase().includes(lower)) return 'package.json dependencies';
  }
  return 'package.json / config files';
}

export const noInferableStack = {
  name: 'no-inferable-stack',
  severity: 'warn',
  description: 'Flags tech stack descriptions discoverable from package.json and config files',

  run(parsedFile, projectData) {
    const diagnostics = [];
    const { lines, codeBlocks } = parsedFile;
    const inferableSet = buildInferableSet(projectData);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (isInCodeBlock(i, codeBlocks)) continue;

      // Skip lines with "why" / version explanations
      if (EXCEPTION_PATTERNS.some(p => p.test(line))) continue;

      let matched = false;
      for (const pattern of STACK_PATTERNS) {
        if (pattern.test(line)) {
          matched = true;
          break;
        }
      }

      if (!matched) continue;

      // Extract technologies mentioned
      const techs = extractTechs(line);
      if (techs.length === 0) {
        // Flag the line even without specific tech extraction (e.g., "## Tech Stack")
        diagnostics.push({
          rule: 'no-inferable-stack',
          severity: 'warn',
          line: i + 1,
          endLine: null,
          message: `"${line.trim()}" — tech stack section is discoverable from package.json dependencies / config files`,
          suggestion:
            'Agents infer the tech stack automatically. Keep only what they can\'t discover:\n' +
            '  version constraints, non-obvious choices, or "why" explanations.',
        });
        continue;
      }

      const inferableTechs = techs.filter(t => isTechInferable(t, inferableSet));
      const nonInferableTechs = techs.filter(t => !isTechInferable(t, inferableSet));

      if (inferableTechs.length === 0) continue;

      const source = detectSource(inferableTechs[0], projectData);
      let message;
      if (nonInferableTechs.length === 0) {
        message = `"${line.trim()}" — discoverable from ${source} (package.json dependencies / file extensions / config files)`;
      } else {
        message = `"${line.trim()}" — ${inferableTechs.join(', ')} discoverable from ${source}`;
      }

      diagnostics.push({
        rule: 'no-inferable-stack',
        severity: 'warn',
        line: i + 1,
        endLine: null,
        message,
        suggestion:
          'Agents infer the tech stack automatically. Keep only what they can\'t discover:\n' +
          '  version constraints, non-obvious choices, or "why" explanations.',
      });
    }

    return diagnostics;
  },
};
