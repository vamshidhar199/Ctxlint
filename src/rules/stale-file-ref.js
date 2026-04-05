import { existsSync } from 'fs';
import { join, basename } from 'path';
import { isInCodeBlock } from '../parser/context-file.js';

const PRIMARY_PATTERN = /`([^`\s]+\.[a-zA-Z]{1,10})`/g;
const SECONDARY_PATTERN = /(?:^|\s)((?:\.\/|\.\.\/|src\/|lib\/|app\/|test\/|tests\/|pkg\/|cmd\/|internal\/|server\/|client\/|api\/|pages\/|components\/|utils\/|hooks\/|services\/|models\/|routes\/|middleware\/|config\/|scripts\/|tools\/|docs\/)[\w/.@-]+)/gm;
const DIR_PATTERN = /`([^`\s]+\/)`/g;

const COMMAND_LINE_PREFIXES = /^\s*(\$|>|npm|yarn|pnpm|bun|pip|uv|cargo|go|make|gradle|mvn|npx|node|python|ruby|bash|sh|zsh)\s/;

// Well-known generated / excluded directories that may not exist in a fresh clone
const GENERATED_DIRS = new Set([
  'node_modules', 'dist', 'build', '.next', '.nuxt', 'target', 'vendor',
  '__pycache__', '.venv', 'venv', 'coverage', '.turbo', '.vercel', '.output',
  '.cache', 'out', '.parcel-cache',
]);

function isLikelyPackageName(path) {
  // npm package names: @scope/pkg or simple-name
  // They don't have sub-directories or extensions that look like real project files
  if (path.startsWith('@') && path.split('/').length === 2 && !/\.\w+$/.test(path)) return true;
  // If it has no slash and no extension that's a project file extension, skip
  if (!path.includes('/') && /^[a-z][\w.-]*$/.test(path)) return true;
  return false;
}

// Common local source directories — paths starting with these are never npm packages
const LOCAL_DIR_PREFIXES = new Set([
  'src', 'lib', 'app', 'test', 'tests', 'pkg', 'cmd', 'internal',
  'server', 'client', 'api', 'pages', 'components', 'utils', 'hooks',
  'services', 'models', 'routes', 'middleware', 'config', 'scripts',
  'tools', 'docs', 'examples', 'packages', 'crates', 'libs',
]);

function isNpmSubpathImport(path) {
  // Matches patterns like "react-dom/server.edge", "some-pkg/subpath/file"
  // where the first segment looks like a package name (no leading . or /)
  // and the path doesn't resemble a local filesystem path
  if (path.startsWith('.') || path.startsWith('/')) return false;
  const segments = path.split('/');
  if (segments.length < 2) return false;
  const pkg = segments[0];
  // Exclude common local source directory names
  if (LOCAL_DIR_PREFIXES.has(pkg)) return false;
  // Package names are lowercase with hyphens/dots
  if (!/^[a-z][\w.-]*$/.test(pkg)) return false;
  // Must contain a hyphen (real npm packages with subpath exports are hyphenated)
  // or be a scoped package — bare single-word paths like "go/types" are language paths
  if (!pkg.includes('-') && !pkg.includes('.')) return false;
  // If it has a file extension in any segment (e.g. server.edge, client.mjs), treat as npm subpath
  return segments.slice(1).some(s => /\.[a-z]+$/.test(s));
}

function containsGeneratedDirSegment(path) {
  // Returns true if any path segment is a well-known generated directory
  const normalized = path.replace(/\\/g, '/').replace(/\/$/, '');
  const segments = normalized.split('/');
  return segments.some(s => GENERATED_DIRS.has(s));
}

function findFileSuggestion(missingPath, projectData) {
  const name = basename(missingPath);
  for (const f of projectData.files) {
    if (basename(f) === name) {
      return f;
    }
  }
  return null;
}

export const staleFileRef = {
  name: 'stale-file-ref',
  severity: 'error',
  description: 'Flags references to files/directories that do not exist in the project',

  run(parsedFile, projectData) {
    const diagnostics = [];
    const { lines, codeBlocks } = parsedFile;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Skip lines inside code blocks that look like commands
      if (isInCodeBlock(i, codeBlocks)) {
        if (COMMAND_LINE_PREFIXES.test(line)) continue;
        // Still check file refs inside non-command code blocks? Per spec, skip command code blocks.
        // We'll skip all code block lines to avoid false positives on example paths.
        continue;
      }

      const checked = new Set();

      const checkPath = (rawPath) => {
        // Normalize
        let p = rawPath.replace(/^\.\//, '');
        p = p.replace(/\\/g, '/');

        if (checked.has(p)) return;
        checked.add(p);

        // Skip URLs
        if (p.startsWith('http://') || p.startsWith('https://')) return;

        // Skip parent-relative paths — can't verify references to sibling repos
        if (p.startsWith('../')) return;

        // Skip glob patterns
        if (p.includes('*')) return;

        // Skip likely package names
        if (isLikelyPackageName(p)) return;

        // Skip npm package subpath imports (e.g. react-dom/server.edge)
        if (isNpmSubpathImport(p)) return;

        // Skip paths referencing well-known generated directories
        if (containsGeneratedDirSegment(p)) return;

        // Check if file/dir exists
        const fileExists = projectData.files.has(p);
        const dirPath = p.endsWith('/') ? p.slice(0, -1) : p;
        const dirExists = projectData.dirs.has(dirPath) || projectData.dirs.has(p);

        if (!fileExists && !dirExists) {
          // Double-check with filesystem
          const fullPath = join(projectData.dir, p);
          if (existsSync(fullPath)) return;

          const suggestion = findFileSuggestion(p, projectData);

          diagnostics.push({
            rule: 'stale-file-ref',
            severity: 'error',
            line: i + 1,
            endLine: null,
            message: `references \`${rawPath}\` but this file does not exist`,
            suggestion: suggestion
              ? `Did you mean \`${suggestion}\`? Stale references actively mislead agents into searching for non-existent files.`
              : 'Stale references actively mislead agents into searching for non-existent files.',
          });
        }
      };

      // PRIMARY: backtick-wrapped file paths
      let m;
      PRIMARY_PATTERN.lastIndex = 0;
      while ((m = PRIMARY_PATTERN.exec(line)) !== null) {
        checkPath(m[1]);
      }

      // DIR_PATTERN: backtick-wrapped directory paths
      DIR_PATTERN.lastIndex = 0;
      while ((m = DIR_PATTERN.exec(line)) !== null) {
        checkPath(m[1]);
      }

      // SECONDARY: path-like references without backticks
      SECONDARY_PATTERN.lastIndex = 0;
      while ((m = SECONDARY_PATTERN.exec(line)) !== null) {
        const p = m[1].trim();
        // Only check if it looks like it has an extension or ends in /
        if (/\.\w+$/.test(p) || p.endsWith('/')) {
          checkPath(p);
        }
      }
    }

    return diagnostics;
  },
};
