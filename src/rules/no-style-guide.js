import { STYLE_GUIDE_PATTERNS } from '../constants.js';
import { isInCodeBlock } from '../parser/context-file.js';

// Naming/casing rules require a linter (eslint), not just a formatter (prettier)
const NAMING_PATTERNS = [
  /camelCase|PascalCase|snake_case|kebab-case/i,
  /naming\s+convention/i,
];

function isNamingRule(line) {
  return NAMING_PATTERNS.some(p => p.test(line));
}

// Formatter configs that handle formatting but NOT naming conventions
const FORMATTER_ONLY_CONFIGS = new Set([
  '.prettierrc', '.prettierrc.js', '.prettierrc.json', '.prettierrc.yml',
  'prettier.config.js', 'prettier.config.mjs', 'rustfmt.toml',
]);

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

          const hasLinter = projectData.hasLinter && projectData.linterConfigs.length > 0;
          const linterConfig = hasLinter ? projectData.linterConfigs[0] : null;
          const formatterOnly = linterConfig && FORMATTER_ONLY_CONFIGS.has(linterConfig);
          const namingRule = isNamingRule(line);

          if (hasLinter && !(formatterOnly && namingRule)) {
            message = `"${line.trim()}" — your ${linterConfig} already enforces this`;
            suggestion = 'Agents follow formatter output, not prose instructions.';
          } else if (namingRule) {
            message = `"${line.trim()}" — naming conventions belong in an eslint config, not a context file`;
            suggestion = 'Consider using eslint id-match or @typescript-eslint/naming-convention rules.';
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
