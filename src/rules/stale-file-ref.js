import { existsSync } from 'fs';
import { join, basename } from 'path';
import { isInCodeBlock } from '../parser/context-file.js';

const PRIMARY_PATTERN = /`([^`\s]+\.[a-zA-Z]{1,10})`/g;
const SECONDARY_PATTERN = /(?:^|\s)((?:\.\/|\.\.\/|src\/|lib\/|app\/|test\/|tests\/|pkg\/|cmd\/|internal\/|server\/|client\/|api\/|pages\/|components\/|utils\/|hooks\/|services\/|models\/|routes\/|middleware\/|config\/|scripts\/|tools\/|docs\/)[\w/.@-]+)/gm;
const DIR_PATTERN = /`([^`\s]+\/)`/g;

const COMMAND_LINE_PREFIXES = /^\s*(\$|>|npm|yarn|pnpm|bun|pip|uv|cargo|go|make|gradle|mvn|npx|node|python|ruby|bash|sh|zsh)\s/;

// Patterns that look like file paths but are actually npm package names or other non-file things
const PACKAGE_LIKE_PATTERN = /^(@[a-z][\w.-]*\/[a-z][\w.-]*|[a-z][\w.-]*)$/;

function isLikelyPackageName(path) {
  // npm package names: @scope/pkg or simple-name
  // They don't have sub-directories or extensions that look like real project files
  if (path.startsWith('@') && path.split('/').length === 2 && !/\.\w+$/.test(path)) return true;
  // If it has no slash and no extension that's a project file extension, skip
  if (!path.includes('/') && /^[a-z][\w.-]*$/.test(path)) return true;
  return false;
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

        // Skip glob patterns
        if (p.includes('*')) return;

        // Skip likely package names
        if (isLikelyPackageName(p)) return;

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
