// Context file names in priority order (first found wins)
export const CONTEXT_FILES = [
  'AGENTS.md',
  'CLAUDE.md',
  'GEMINI.md',
  '.github/copilot-instructions.md',
];

// Also check for .cursorrules (no extension) and .cursor/rules/ directory
export const CURSOR_FILES = ['.cursorrules'];
export const CURSOR_RULES_DIR = '.cursor/rules';

// Severity levels
export const SEVERITY = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
};

// Default thresholds
export const THRESHOLDS = {
  MAX_LINES_WARN: 200,
  MAX_LINES_ERROR: 400,
  MAX_LINES_EXCELLENT: 60,
  TOKENS_PER_CHAR: 0.25,             // ~4 chars per token heuristic
  TRIGRAM_OVERLAP_THRESHOLD: 0.40,    // 40% overlap = redundant
};

// ANSI color codes (no chalk dependency)
export const ANSI = {
  RED: '\x1b[31m',
  YELLOW: '\x1b[33m',
  BLUE: '\x1b[34m',
  GREEN: '\x1b[32m',
  GRAY: '\x1b[90m',
  BOLD: '\x1b[1m',
  DIM: '\x1b[2m',
  RESET: '\x1b[0m',
  UNDERLINE: '\x1b[4m',
};

// Known package managers and their lockfiles
export const PACKAGE_MANAGERS = {
  'package-lock.json': 'npm',
  'yarn.lock': 'yarn',
  'pnpm-lock.yaml': 'pnpm',
  'bun.lockb': 'bun',
  'bun.lock': 'bun',
};

// Known Python package managers and their lockfiles
export const PYTHON_MANAGERS = {
  'uv.lock': 'uv',
  'poetry.lock': 'poetry',
  'Pipfile.lock': 'pipenv',
  'requirements.txt': 'pip',
};

// File extensions that indicate language/framework
export const LANGUAGE_INDICATORS = {
  'tsconfig.json': 'TypeScript',
  'jsconfig.json': 'JavaScript',
  'pyproject.toml': 'Python',
  'setup.py': 'Python',
  'Cargo.toml': 'Rust',
  'go.mod': 'Go',
  'Gemfile': 'Ruby',
  'build.gradle': 'Java/Kotlin',
  'pom.xml': 'Java',
};

// Linter config files (presence means style is enforced by tooling)
export const LINTER_CONFIGS = [
  '.eslintrc', '.eslintrc.js', '.eslintrc.json', '.eslintrc.yml', '.eslintrc.yaml',
  'eslint.config.js', 'eslint.config.mjs', 'eslint.config.ts',
  '.prettierrc', '.prettierrc.js', '.prettierrc.json', '.prettierrc.yml',
  'prettier.config.js', 'prettier.config.mjs',
  'ruff.toml',
  'rustfmt.toml',
  '.editorconfig',
  'biome.json', 'biome.jsonc',
  '.stylelintrc', '.stylelintrc.json',
  'deno.json', 'deno.jsonc',
];

// Style guide phrases that belong in a linter, not a context file
export const STYLE_GUIDE_PATTERNS = [
  /use\s+(camelCase|snake_case|PascalCase|kebab-case)/i,
  /indent\s+(with|using)\s+\d+\s+(spaces?|tabs?)/i,
  /prefer\s+(const|let|var)\s+(over|instead)/i,
  /(always|never)\s+use\s+semicolons?/i,
  /use\s+(single|double)\s+quotes?/i,
  /trailing\s+commas?/i,
  /max(imum)?\s+(line\s+)?length/i,
  /naming\s+convention/i,
  /\d+\s+(spaces?|tabs?)\s+(for\s+)?indent/i,
  /tab\s+size/i,
  /line\s+endings?/i,
  /end\s+(of\s+)?file\s+newline/i,
];
