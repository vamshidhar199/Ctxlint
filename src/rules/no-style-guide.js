import { STYLE_GUIDE_PATTERNS } from '../constants.js';
import { isInCodeBlock } from '../parser/context-file.js';

export const noStyleGuide = {
  name: 'no-style-guide',
  severity: 'info',
  description: 'Flags coding style rules that belong in a linter config, not a context file',

  run(parsedFile, projectData) {
    const diagnostics = [];
    const { lines, codeBlocks } = parsedFile;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (isInCodeBlock(i, codeBlocks)) continue;

      for (const pattern of STYLE_GUIDE_PATTERNS) {
        if (pattern.test(line)) {
          let message;
          let suggestion;

          if (projectData.hasLinter && projectData.linterConfigs.length > 0) {
            const linterConfig = projectData.linterConfigs[0];
            message = `"${line.trim()}" — your ${linterConfig} already enforces this`;
            suggestion = 'Agents follow formatter output, not prose instructions.';
          } else {
            message = `"${line.trim()}" — coding style rules belong in a linter configuration, not a context file`;
            suggestion = 'Consider setting up eslint/prettier/ruff to enforce this automatically.';
          }

          diagnostics.push({
            rule: 'no-style-guide',
            severity: 'info',
            line: i + 1,
            endLine: null,
            message,
            suggestion,
          });
          break;
        }
      }
    }

    return diagnostics;
  },
};
