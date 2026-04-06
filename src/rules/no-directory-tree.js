import { isInCodeBlock } from '../parser/context-file.js';
import { THRESHOLDS } from '../constants.js';

const TREE_CHARS = /[├└│┌┐┘┤┬─]{2,}/;
const INDENTED_FILE = /^\s{2,}[\w.-]+\.(js|ts|jsx|tsx|py|go|rs|rb|java|kt|swift|css|scss|html|vue|svelte|json|yaml|yml|toml|md|sql|sh|bash|zsh)\s*$/;
const STRUCTURE_HEADING = /^#{1,3}\s*(project\s+structure|directory|file\s+(structure|layout|tree|organization)|folder\s+structure|codebase\s+(structure|layout|overview))/i;

function estimateTokens(lineCount, lines) {
  const chars = lines.reduce((sum, l) => sum + l.length + 1, 0);
  return Math.round(chars * THRESHOLDS.TOKENS_PER_CHAR);
}

export const noDirectoryTree = {
  name: 'no-directory-tree',
  severity: 'error',
  description: 'Flags embedded directory tree structures that add cost without improving agent navigation',

  run(parsedFile, projectData) {
    const diagnostics = [];
    const { lines, codeBlocks } = parsedFile;

    const flagged = new Array(lines.length).fill(false);

    // Track which "project structure" heading sections we're in
    let inStructureSection = false;
    let structureSectionStart = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Detect structure headings (outside code blocks only)
      if (!isInCodeBlock(i, codeBlocks) && STRUCTURE_HEADING.test(line)) {
        inStructureSection = true;
        structureSectionStart = i;
        continue;
      }

      // Reset section when we hit the next heading of same/higher level
      if (!isInCodeBlock(i, codeBlocks) && /^#{1,3}\s/.test(line) && !STRUCTURE_HEADING.test(line)) {
        inStructureSection = false;
      }

      // Condition a: tree-drawing characters — flag anywhere (code block or not)
      if (TREE_CHARS.test(line)) {
        flagged[i] = true;
        continue;
      }

      // Condition b: indented file listing — only outside code blocks
      if (!isInCodeBlock(i, codeBlocks) && INDENTED_FILE.test(line)) {
        // Check adjacent lines for same pattern (avoid single-file false positives)
        const prevMatches = i > 0 && INDENTED_FILE.test(lines[i - 1]);
        const nextMatches = i < lines.length - 1 && INDENTED_FILE.test(lines[i + 1]);
        if (prevMatches || nextMatches) {
          flagged[i] = true;
          continue;
        }
      }

      // Condition c: under a structure heading section, flag lines with tree chars (already handled by a)
      // Also flag the opening ``` of a code block that immediately follows a structure heading
      if (inStructureSection && isInCodeBlock(i, codeBlocks)) {
        // Inside a code block in a structure section — flag it as a tree
        flagged[i] = true;
      }
    }

    // Group consecutive flagged lines into diagnostics
    let rangeStart = -1;
    for (let i = 0; i <= lines.length; i++) {
      if (i < lines.length && flagged[i]) {
        if (rangeStart === -1) rangeStart = i;
      } else {
        if (rangeStart !== -1) {
          const rangeEnd = i - 1;
          const rangeLines = lines.slice(rangeStart, rangeEnd + 1);
          const lineCount = rangeEnd - rangeStart + 1;
          const tokenEstimate = estimateTokens(lineCount, rangeLines);

          diagnostics.push({
            rule: 'no-directory-tree',
            severity: 'error',
            line: rangeStart + 1,
            endLine: rangeEnd + 1,
            message: `Lines ${rangeStart + 1}-${rangeEnd + 1} contain a directory tree (${lineCount} lines, ~${tokenEstimate} tokens).`,
            suggestion:
              'Agents discover file structure via ls/find on their own.\n' +
              'Agents can explore file structure on their own — this just adds noise.\n' +
              'Consider removing entirely, or keep only non-standard directories:\n' +
              '  "Non-standard: .ml-cache/ stores pre-trained model weights"',
          });
          rangeStart = -1;
        }
      }
    }

    return diagnostics;
  },
};
