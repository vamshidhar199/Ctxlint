# ctxlint — Complete Implementation Specification for Claude Code

## WHAT YOU ARE BUILDING

ctxlint is a CLI tool that lints AI agent context files (AGENTS.md, CLAUDE.md, GEMINI.md, .cursorrules, copilot-instructions.md). It detects stale references, inferable content, redundant documentation, and token waste. It is the first tool to operationalize findings from the ETH Zurich study (arXiv:2602.11988, Feb 2026) which proved that bloated context files reduce AI coding agent performance by 3% while increasing costs by 20%.

**Core philosophy**: Tell developers what to REMOVE from their context files, not what to ADD. Less context = better agent performance.

## KEY DECISIONS (ALREADY MADE — DO NOT CHANGE)

1. **Language**: Node.js (ESM modules). Target Node 18+.
2. **Dependencies**: ONLY `commander` for CLI. Nothing else in production deps. `vitest` for dev.
3. **No LLM calls**: Everything is deterministic file-system analysis, regex, and string matching.
4. **No chalk/colors library**: Use raw ANSI escape codes for terminal colors (keep zero-dep).
5. **Synchronous file I/O**: Use `fs.readFileSync` everywhere. Simpler, fast enough for a linter.
6. **ESM only**: All files use `import/export`, `"type": "module"` in package.json.
7. **License**: MIT.
8. **Executable via npx**: `npx ctxlint check` must work with zero prior install.

---

## PROJECT STRUCTURE

Create exactly this structure:

```
ctxlint/
├── bin/
│   └── ctxlint.js                    # CLI entry point (hashbang, imports src/cli.js)
├── src/
│   ├── cli.js                        # Commander setup, command definitions
│   ├── constants.js                  # Shared constants (file names, thresholds, ANSI codes)
│   ├── detector/
│   │   ├── context-file.js           # Find which context file(s) exist in a project
│   │   └── project.js                # Detect build system, language, framework, extract metadata
│   ├── parser/
│   │   └── context-file.js           # Parse a context file into structured sections and lines
│   ├── rules/
│   │   ├── index.js                  # Rule registry — exports array of all rules
│   │   ├── no-directory-tree.js      # Rule: flags embedded directory tree structures
│   │   ├── stale-file-ref.js         # Rule: flags references to files/dirs that don't exist
│   │   ├── stale-command.js          # Rule: flags build commands that don't match package.json/Makefile
│   │   ├── no-inferable-stack.js     # Rule: flags tech stack descriptions discoverable from config
│   │   ├── redundant-readme.js       # Rule: flags content that overlaps with README.md
│   │   ├── no-style-guide.js         # Rule: flags coding style rules (linter's job, not context file's)
│   │   ├── max-lines.js             # Rule: flags files exceeding line thresholds
│   │   └── token-budget.js           # Rule: estimates token cost and reports waste
│   ├── commands/
│   │   ├── check.js                  # `ctxlint check` implementation
│   │   ├── init.js                   # `ctxlint init` implementation
│   │   ├── slim.js                   # `ctxlint slim` implementation
│   │   └── diff.js                   # `ctxlint diff` implementation
│   └── reporter/
│       ├── terminal.js               # Human-readable colored terminal output
│       └── json.js                   # Machine-readable JSON output
├── test/
│   ├── fixtures/
│   │   ├── healthy-repo/             # Minimal, high-signal context file (should pass clean)
│   │   ├── bloated-repo/             # Every anti-pattern (should fail with many diagnostics)
│   │   ├── stale-repo/               # Stale references to deleted files/changed commands
│   │   └── no-context-repo/          # No context file (for testing init command)
│   ├── rules/
│   │   ├── no-directory-tree.test.js
│   │   ├── stale-file-ref.test.js
│   │   ├── stale-command.test.js
│   │   ├── no-inferable-stack.test.js
│   │   ├── redundant-readme.test.js
│   │   ├── no-style-guide.test.js
│   │   ├── max-lines.test.js
│   │   └── token-budget.test.js
│   ├── commands/
│   │   ├── check.test.js
│   │   ├── init.test.js
│   │   └── slim.test.js
│   └── integration/
│       └── cli.test.js               # End-to-end CLI tests
├── package.json
├── vitest.config.js
├── .gitignore
├── AGENTS.md                         # Dogfooding: ctxlint's own context file
├── scripts/
│   └── validate-real-repos.sh        # Real-repo validation (Phase 6)
├── LICENSE
└── README.md
```

---

## FILE-BY-FILE SPECIFICATIONS

### bin/ctxlint.js

```javascript
#!/usr/bin/env node
import { run } from '../src/cli.js';
run(process.argv);
```

That's the entire file. Keep it minimal.

---

### src/constants.js

```javascript
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
```

---

### src/detector/context-file.js

Finds context file(s) in the project directory.

```
Input:  projectDir (string) — absolute path to the project root
Output: Array<{ name: string, path: string, content: string }> — found context files

Logic:
1. Iterate through CONTEXT_FILES in order
2. For each, check if file exists at path.join(projectDir, name)
3. If found, read its content and add to results array
4. Also check CURSOR_FILES
5. Return all found files (there may be multiple — e.g., both AGENTS.md and CLAUDE.md)
6. If none found, return empty array
```

---

### src/detector/project.js

Scans the project directory and extracts metadata that rules need.

```
Input:  projectDir (string)
Output: ProjectData object:
{
  dir: string,                              // absolute project path
  files: Set<string>,                       // all file paths relative to project root
  dirs: Set<string>,                        // all directory paths relative to project root
  packageJson: object | null,               // parsed package.json if exists
  scripts: Record<string, string> | null,   // package.json scripts
  dependencies: Set<string>,                // all dep names (deps + devDeps + peerDeps)
  packageManager: string | null,            // 'npm' | 'yarn' | 'pnpm' | 'bun' | null
  pythonManager: string | null,             // 'uv' | 'poetry' | 'pipenv' | 'pip' | null
  languages: string[],                      // detected languages
  frameworks: string[],                     // detected frameworks (from deps)
  hasLinter: boolean,                       // true if any linter config exists
  linterConfigs: string[],                  // which linter configs were found
  readme: string | null,                    // README.md content if exists
  makefileTargets: string[] | null,         // Makefile target names if Makefile exists
}

Logic for building file/dir sets:
1. Recursively walk projectDir
2. Respect .gitignore if present (simple implementation: skip node_modules, .git, 
   dist, build, __pycache__, .venv, venv, .next, .nuxt, target, vendor)
3. Store paths relative to projectDir (e.g., "src/auth/middleware.ts")
4. Limit depth to 5 levels (performance)
5. Limit total files to 10,000 (performance)

Logic for detecting frameworks from package.json dependencies:
- "react" → "React"
- "next" → "Next.js"
- "vue" → "Vue"
- "nuxt" → "Nuxt"
- "angular" or "@angular/core" → "Angular"
- "express" → "Express"
- "fastify" → "Fastify"
- "hono" → "Hono"
- "prisma" or "@prisma/client" → "Prisma"
- "drizzle-orm" → "Drizzle"
- "tailwindcss" → "Tailwind CSS"
- "svelte" → "Svelte"

Logic for Makefile targets:
- Read Makefile, extract lines matching /^([a-zA-Z_][\w-]*)\s*:/
- Return array of target names
```

---

### src/parser/context-file.js

Parses a context file into a structured format that rules can analyze.

```
Input:  content (string) — raw context file content
Output: ParsedContextFile object:
{
  lines: string[],                          // all lines (0-indexed)
  sections: Array<{
    heading: string,                        // e.g., "## Project Structure"
    headingLine: number,                    // line number of the heading
    startLine: number,                      // first content line after heading
    endLine: number,                        // last content line before next heading
    content: string,                        // raw content of the section
    inCodeBlock: boolean,                   // true if entire section is in a fenced code block
  }>,
  codeBlocks: Array<{                      // ranges that are inside ``` fences
    startLine: number,
    endLine: number,
  }>,
  totalLines: number,
  nonEmptyLines: number,
}

Logic:
1. Split content by newlines
2. Track code block state (toggle on ```)
3. Split into sections by ## headings (or # headings)
4. For each section, record line range and content
5. Lines inside code blocks should be marked so rules can skip them
```

**Important**: Provide a helper function `isInCodeBlock(lineNumber, codeBlocks)` that rules can use to skip lines inside fenced code blocks.

---

### src/rules/index.js

```javascript
import { noDirectoryTree } from './no-directory-tree.js';
import { staleFileRef } from './stale-file-ref.js';
import { staleCommand } from './stale-command.js';
import { noInferableStack } from './no-inferable-stack.js';
import { redundantReadme } from './redundant-readme.js';
import { noStyleGuide } from './no-style-guide.js';
import { maxLines } from './max-lines.js';
import { tokenBudget } from './token-budget.js';

export const rules = [
  noDirectoryTree,
  staleFileRef,
  staleCommand,
  noInferableStack,
  redundantReadme,
  noStyleGuide,
  maxLines,
  tokenBudget,
];
```

---

### RULE INTERFACE

Every rule module exports a single object:

```javascript
export const ruleName = {
  name: 'rule-name',              // kebab-case identifier
  severity: 'error',              // default severity: 'error' | 'warn' | 'info'
  description: 'Short description of what this rule checks',
  run(parsedFile, projectData) {  // returns Diagnostic[]
    // ...analysis logic...
    return diagnostics;
  }
};
```

A Diagnostic is:

```javascript
{
  rule: string,           // rule name
  severity: string,       // 'error' | 'warn' | 'info'
  line: number,           // 1-indexed line number (for human display)
  endLine: number | null, // end line for multi-line issues (1-indexed), null for single-line
  message: string,        // human-readable explanation of the problem
  suggestion: string,     // actionable fix suggestion
}
```

---

### RULE IMPLEMENTATIONS (DETAILED LOGIC)

#### src/rules/no-directory-tree.js

**Name**: `no-directory-tree`  
**Severity**: `error`  
**Research basis**: ETH Zurich 2026 — codebase overviews don't reduce agent navigation time, 100% of auto-generated files contained them.

**Detection algorithm**:

```
1. Scan each line of the context file.
2. Skip lines inside code blocks (using isInCodeBlock helper).
3. Flag a line if ANY of these match:
   a. Contains tree-drawing characters: /[├└│┌┐┘┤┬─]{2,}/
   b. Is part of an indented file listing: matches /^\s{2,}[\w.-]+\.(js|ts|jsx|tsx|py|go|rs|rb|java|kt|swift|css|scss|html|vue|svelte|json|yaml|yml|toml|md|sql|sh|bash|zsh)\s*$/
      AND the previous or next line also matches the same pattern (to avoid false positives on single file mentions)
   c. Is under a heading that matches: /^#{1,3}\s*(project\s+structure|directory|file\s+(structure|layout|tree|organization)|folder\s+structure|codebase\s+(structure|layout|overview))/i

4. Group consecutive flagged lines into a single diagnostic (report line range, not individual lines).

5. Do NOT flag:
   - Single-line file references like "See `src/auth.ts`" (handled by stale-file-ref)
   - Lines inside fenced code blocks that are clearly command examples
   - Lines under a heading like "## Non-obvious patterns" that mention specific files with explanations
```

**Output template**:
```
Lines {startLine}-{endLine} contain a directory tree ({lineCount} lines, ~{tokenEstimate} tokens).
Agents discover file structure via ls/find on their own.
ETH Zurich (2026) found this adds cost without improving task success.
Consider removing entirely, or keep only non-standard directories:
  "Non-standard: .ml-cache/ stores pre-trained model weights"
```

---

#### src/rules/stale-file-ref.js

**Name**: `stale-file-ref`  
**Severity**: `error`  
**Research basis**: Augment Code 2026 — "references become liabilities when code changes"

**Detection algorithm**:

```
1. Build a regex to extract file/directory path references:
   PRIMARY_PATTERN: /`([^`\s]+\.[a-zA-Z]{1,10})`/g  — backtick-wrapped file paths
   SECONDARY_PATTERN: /(?:^|\s)((?:\.\/|\.\.\/|src\/|lib\/|app\/|test\/|tests\/|pkg\/|cmd\/|internal\/|server\/|client\/|api\/|pages\/|components\/|utils\/|hooks\/|services\/|models\/|routes\/|middleware\/|config\/|scripts\/|tools\/|docs\/)[\w/.@-]+)/gm
   DIR_PATTERN: /`([^`\s]+\/)`/g  — backtick-wrapped directory paths (ending in /)
   
2. For each extracted path:
   a. Normalize: remove leading ./ if present
   b. Skip if it's a URL (starts with http:// or https://)
   c. Skip if it contains glob characters (* or **)
   d. Skip if it matches a well-known non-file pattern (e.g., npm package names like "react", "@prisma/client")
   e. Skip if the line is inside a code block AND the code block looks like a command (starts with $, >, npm, yarn, etc.)
   f. Check: does this file/directory exist relative to projectData.dir?
      - Use projectData.files Set for files
      - Use projectData.dirs Set for directories
   g. If NOT found → create diagnostic

3. For files not found, try to suggest a correction:
   - Check if a file with the same basename exists elsewhere in the project
   - If found, suggest: "Did you mean `{correctPath}`?"
```

**Output template**:
```
Line {line}: references `{path}` but this file does not exist.
{suggestion if available: "Did you mean `{correctPath}`?"}
Stale references actively mislead agents into searching for non-existent files.
```

---

#### src/rules/stale-command.js

**Name**: `stale-command`  
**Severity**: `error`  
**Research basis**: Lulla et al. 2026 — agents execute commands from context files significantly more. A wrong command wastes cycles.

**Detection algorithm**:

```
1. Extract command-like patterns from the context file:
   NPM_SCRIPT: /`(npm|yarn|pnpm|bun)\s+run\s+([\w:.-]+)`/g
   NPM_DIRECT: /`(npm|yarn|pnpm|bun)\s+(test|start|build|dev|lint|format|typecheck|check|deploy|migrate|seed)`/g
   MAKE_TARGET: /`make\s+([\w.-]+)`/g
   GENERIC_CMD: /(?:^|\n)\s*(?:\$|>)\s*((?:npm|yarn|pnpm|bun|pip|uv|cargo|go|make|gradle|mvn)\s+.+)/gm

2. For npm/yarn/pnpm/bun run commands:
   a. Extract the script name
   b. Check if that script exists in projectData.scripts
   c. If NOT found → create diagnostic
   d. Also check: does the context file specify a DIFFERENT package manager than what the project uses?
      - Context says "npm run X" but project has pnpm-lock.yaml → warn
      - Context says "pip install" but project has uv.lock → warn

3. For make targets:
   a. Extract the target name
   b. Check if it exists in projectData.makefileTargets
   c. If NOT found → create diagnostic

4. Package manager mismatch:
   a. Scan context file for mentions of npm/yarn/pnpm/bun/pip/uv/poetry
   b. Compare against projectData.packageManager and projectData.pythonManager
   c. If mismatch → create warning diagnostic
```

**Output template (missing script)**:
```
Line {line}: `{command}` — script "{scriptName}" does not exist in package.json.
Available scripts: {comma-separated list of actual scripts}
```

**Output template (package manager mismatch)**:
```
Line {line}: context references `{mentioned}` but project uses `{actual}` ({lockfile} detected).
Consider updating to `{correctedCommand}`.
```

---

#### src/rules/no-inferable-stack.js

**Name**: `no-inferable-stack`  
**Severity**: `warn`  
**Research basis**: ETH Zurich 2026 — tech stack descriptions don't help agents navigate faster.

**Detection algorithm**:

```
1. Build list of inferable technologies from projectData:
   - projectData.languages → ["TypeScript", "Python", etc.]
   - projectData.frameworks → ["React", "Next.js", "Express", etc.]
   - projectData.dependencies → individual package names

2. Build regex patterns for common stack description phrases:
   STACK_PATTERNS:
   - /built\s+with\s+(.+)/i
   - /tech(nology)?\s+stack\s*[:=-]/i
   - /this\s+(is\s+a|project\s+is\s+a?)\s+\w+\s+(project|app|application|service|api)/i
   - /we\s+use\s+(React|Vue|Angular|Next|Express|Django|Flask|Rails|Spring)/i
   - /uses?\s+(TypeScript|JavaScript|Python|Go|Rust|Ruby|Java|Kotlin)/i
   - /database:\s*(PostgreSQL|MySQL|MongoDB|Redis|SQLite)/i
   - /written\s+in\s+(TypeScript|JavaScript|Python|Go|Rust)/i

3. For each line matching a STACK_PATTERN:
   a. Extract the technology names mentioned
   b. Check if each technology is in projectData.languages or projectData.frameworks or projectData.dependencies
   c. If ALL mentioned technologies are inferable → flag the line
   d. If SOME are inferable and some aren't → flag with a more nuanced message

4. Do NOT flag:
   - Version-specific notes: "Must use Node 18+ due to ESM loader bug"
   - "Why" explanations: "We chose SQLite over Postgres for single-tenant deployment"
   - Non-obvious qualifiers: "Uses React Server Components (not client-side rendering)"
   - Lines containing "because", "due to", "reason", "unlike", "instead of", "not the usual"
```

**Output template**:
```
Line {line}: "{matched text}" — discoverable from {source} (package.json dependencies / file extensions / config files).
Agents infer the tech stack automatically. Keep only what they can't discover:
  version constraints, non-obvious choices, or "why" explanations.
```

---

#### src/rules/redundant-readme.js

**Name**: `redundant-readme`  
**Severity**: `warn`  
**Research basis**: ETH Zurich 2026 — LLM-generated context files only help when repos lack documentation.

**Detection algorithm**:

```
1. If projectData.readme is null (no README.md), skip this rule entirely.

2. Normalize text function:
   - Lowercase
   - Remove markdown formatting (##, **, `, [](), etc.)
   - Remove punctuation
   - Collapse whitespace
   - Trim

3. Generate character trigrams from normalized text:
   trigrams("hello world") → ["hel", "ell", "llo", "lo ", "o w", " wo", "wor", "orl", "rld"]

4. For each section in the parsed context file:
   a. Skip sections under 30 characters (too short to meaningfully compare)
   b. Normalize the section content
   c. Generate trigrams for the section
   d. For each section in README.md (split by ## headings):
      - Normalize and generate trigrams
      - Compute overlap: |intersection(ctxTrigrams, readmeTrigrams)| / |min(ctxTrigrams, readmeTrigrams)|
      - If overlap > TRIGRAM_OVERLAP_THRESHOLD (0.40) → flag

5. Report which README section it overlaps with.
```

**Output template**:
```
Lines {startLine}-{endLine} ("{sectionHeading}") overlap ~{percentage}% with README.md section "{readmeSection}".
Agents already read README.md. Remove this section to save ~{tokenEstimate} tokens per session.
```

---

#### src/rules/no-style-guide.js

**Name**: `no-style-guide`  
**Severity**: `info`  
**Research basis**: ETH Zurich 2026 — "Use deterministic linters instead — cheaper, faster, more reliable."

**Detection algorithm**:

```
1. For each line in the context file:
   a. Skip lines inside code blocks
   b. Test against each pattern in STYLE_GUIDE_PATTERNS (from constants.js)
   c. If any pattern matches → flag the line

2. Enhance the message if projectData.hasLinter is true:
   - Mention which linter config was found
   - "Your {linterConfig} already enforces this"

3. Even if no linter config is found, still flag with:
   - "Style rules are better enforced by a linter (eslint, prettier, ruff) than by a context file"
```

**Output template (with linter)**:
```
Line {line}: "{matched text}" — your {linterConfig} already enforces this.
Agents follow formatter output, not prose instructions.
```

**Output template (without linter)**:
```
Line {line}: "{matched text}" — coding style rules belong in a linter configuration, not a context file.
Consider setting up eslint/prettier/ruff to enforce this automatically.
```

---

#### src/rules/max-lines.js

**Name**: `max-lines`  
**Severity**: `warn` (upgrades to `error` above error threshold)  
**Research basis**: Industry consensus — high-performance context files are <200 lines, professionals keep theirs <60.

**Detection algorithm**:

```
1. Count parsedFile.nonEmptyLines (skip blank lines and comment-only lines)
2. Apply thresholds from constants.js:
   - Under EXCELLENT (60): no diagnostic
   - 60-200: info — "Your context file is {n} lines. Good, but review for any inferable content."
   - 200-400: warn — "Your context file is {n} lines. Files over 200 lines almost always contain inferable content."
   - Over 400: error — "Your context file is {n} lines. This is very likely hurting agent performance."
3. Include comparison: "Production teams keep theirs under 60 lines."
```

---

#### src/rules/token-budget.js

**Name**: `token-budget`  
**Severity**: `warn`  
**Research basis**: ETH Zurich 2026 — 20% cost increase from context files.

**Detection algorithm**:

```
1. Estimate total tokens: parsedFile.content.length * TOKENS_PER_CHAR
2. Estimate noise tokens: sum of token estimates for all lines flagged by OTHER rules
   (This rule should run LAST — it needs results from all other rules)
3. Signal tokens = total - noise
4. Signal-to-noise ratio = signal / total

5. Calculate cost projections:
   SONNET_INPUT_PRICE = 3.00 / 1_000_000     // $3.00 per million input tokens
   SONNET_CACHED_PRICE = 0.30 / 1_000_000    // $0.30 per million cached tokens (90% discount)
   
   perSessionUncached = totalTokens * SONNET_INPUT_PRICE
   perSessionCached = totalTokens * SONNET_CACHED_PRICE
   
   // Assume 20 sessions/day, first is uncached, rest are cached
   dailyCostPerDev = perSessionUncached + (19 * perSessionCached)
   monthlyCost(teamSize) = dailyCostPerDev * 20 * teamSize

6. Report breakdown and savings if noise tokens were removed.
```

**Output template**:
```
Context file: {fileName} ({totalLines} lines, ~{totalTokens} tokens)

Token breakdown:
  High-signal (non-inferable):  {signalTokens} tokens ({signalPct}%)  ✓
  Flagged as removable:         {noiseTokens} tokens ({noisePct}%)    ✗
  
Signal-to-noise ratio: {ratio} ({rating: excellent/good/poor/very poor})

Estimated monthly cost (5 developers, 20 sessions/day):
  Current:     ${currentCost}
  After fixes: ${fixedCost} ({savingsPct}% reduction)
```

---

### src/commands/check.js

The core command. Orchestrates detection, scanning, parsing, rule execution, and reporting.

```
Input: projectDir (string), options ({ format: 'terminal'|'json', severity: 'info'|'warn'|'error' })
Output: exit code (0 = clean, 1 = errors found, 2 = runtime error)

Algorithm:
1. Detect context files in projectDir
   - If none found, print message suggesting `ctxlint init` and exit 0
2. Scan project metadata
3. For each found context file:
   a. Parse into structured format
   b. Run all rules (in order defined in rules/index.js)
   c. Collect all diagnostics
   d. Pass diagnostics to token-budget rule (it runs last and needs other results)
4. Filter diagnostics by minimum severity
5. Report using selected reporter (terminal or json)
6. Exit 1 if any diagnostics have severity 'error', else exit 0
```

---

### src/commands/init.js

Generates a minimal context file from project analysis.

```
Input: projectDir (string), options ({ format: 'agents'|'claude'|'gemini'|'all', dryRun: boolean, force: boolean })
Output: writes file(s) or prints to stdout

Algorithm:
1. Scan project metadata
2. Check if context file already exists (unless --force)

3. Generate content from ONLY non-inferable sources:

   Section "## Build & test":
   - From package.json scripts: list all scripts with short descriptions
   - From Makefile targets: list key targets
   - Prefix with package manager: "pnpm run test" not "npm run test"
   - Include the test framework name if detectable

   Section "## Non-obvious patterns" (ONLY if detected):
   - Monorepo structure (if workspaces detected in package.json)
   - Custom directory names that deviate from standard conventions
   - .env.example exists → mention env var requirement
   - Custom entry points (if "main" or "exports" in package.json points somewhere unusual)

   Section "## Constraints" (ONLY if detected):
   - .nvmrc or .node-version → Node version constraint
   - .python-version → Python version constraint
   - engines field in package.json → engine constraints
   - "packageManager" field in package.json → corepack enforcement

4. Assemble content. Target: under 40 lines.
5. If --dry-run, print to stdout. Otherwise write to file.
6. If --format all, write AGENTS.md and create symlinks for CLAUDE.md and GEMINI.md.
```

---

### src/commands/slim.js

Removes flagged content from an existing context file.

```
Input: filePath (string), options ({ dryRun: boolean, backup: boolean })
Output: writes modified file or prints diff to stdout

Algorithm:
1. Read the context file
2. Parse it
3. Scan the project
4. Run all rules to get diagnostics
5. Identify line ranges flagged as 'error' severity
6. Generate slimmed content:
   - Remove all lines within flagged ranges
   - Collapse 3+ consecutive blank lines into 2
   - Preserve everything else exactly as-is
7. If --backup, copy original to {file}.bak
8. If --dry-run, print before/after comparison to stdout
9. Otherwise, write the slimmed file
10. Report: lines reduced, tokens reduced, estimated cost savings
```

---

### src/commands/diff.js

Detects drift between context file and codebase.

```
Input: projectDir (string), options ({ since: string|null, failOnStale: boolean })
Output: drift report, exit 1 if --fail-on-stale and drift detected

Algorithm:
1. Find context file(s)
2. Determine baseline:
   - If --since provided: use that date/git ref
   - Else: use the context file's last modification time from git log
     `git log -1 --format=%aI -- AGENTS.md`
   - Fallback: use fs.statSync mtime

3. Find changed files since baseline:
   - Try: `git diff --name-only --diff-filter=ADMR {ref}..HEAD` (A=added, D=deleted, M=modified, R=renamed)
   - Fallback if not a git repo: skip this analysis

4. Cross-reference:
   a. Extract all file references from the context file (same logic as stale-file-ref)
   b. Check if any referenced file was Deleted or Renamed since baseline → STALE
   c. Check if package.json scripts changed since baseline:
      - `git show {ref}:package.json` → parse scripts
      - Compare with current scripts
      - Any script in context file that was removed/renamed → STALE

5. Report:
   - "Your {contextFile} was last updated {N} days ago"
   - "Since then, {M} referenced items have changed:"
   - List each stale reference with what happened

6. If --fail-on-stale and any STALE items found → exit 1
```

---

### src/reporter/terminal.js

Human-readable colored output.

```
Input: Array<Diagnostic>, summary object (from token-budget), contextFileName
Output: formatted string printed to stdout

Format:
  {contextFileName}
  
    {severity icon} {rule name}  {message}
       {gray: suggestion}
       {gray: line reference}
  
  Summary:
    {errorCount} errors, {warnCount} warnings, {infoCount} info
    ~{totalTokens} tokens ({signalPct}% signal, {noisePct}% noise)

Severity icons:
  error: ✗ (red)
  warn:  ⚠ (yellow)  
  info:  ℹ (blue)

Group diagnostics by rule name. Sort errors first, then warnings, then info.
```

---

### src/reporter/json.js

Machine-readable output for CI pipelines.

```
Input: same as terminal reporter
Output: JSON string to stdout

Schema:
{
  "file": "AGENTS.md",
  "diagnostics": [
    {
      "rule": "stale-file-ref",
      "severity": "error",
      "line": 23,
      "endLine": null,
      "message": "references `src/auth/handler.ts` but this file does not exist",
      "suggestion": "Did you mean `src/auth/middleware.ts`?"
    }
  ],
  "summary": {
    "errors": 3,
    "warnings": 5,
    "info": 2,
    "totalLines": 347,
    "nonEmptyLines": 298,
    "totalTokens": 2840,
    "signalTokens": 680,
    "noiseTokens": 2160,
    "signalRatio": 0.24
  }
}
```

---

### src/cli.js

Commander setup with all four commands.

```
Commands:
  ctxlint check [path]   Lint context file(s) in the project
    --format <type>       Output format: terminal (default), json
    --severity <level>    Minimum severity: info (default), warn, error

  ctxlint init [path]    Generate a minimal context file
    --format <type>       Output: agents (default), claude, gemini, all
    --dry-run             Print to stdout instead of writing
    --force               Overwrite existing file

  ctxlint slim [file]    Remove flagged content from a context file
    --dry-run             Show diff without modifying
    --backup              Save original as .bak

  ctxlint diff [path]    Check for drift between context file and codebase
    --since <ref>         Compare against date or git ref
    --fail-on-stale       Exit 1 if drift detected (for CI)

Global options:
  --version              Show version
  --help                 Show help

Default command (no subcommand): run `check` on current directory.
So `npx ctxlint` is equivalent to `npx ctxlint check .`
```

---

## TEST FIXTURES

### test/fixtures/healthy-repo/

Create these files:

**AGENTS.md** (18 lines — should pass with 0 errors, 0 warnings):
```markdown
# AGENTS.md

## Build & test
- Install: `pnpm install`
- Dev: `pnpm dev`
- Test: `pnpm test` (vitest)
- Lint: `pnpm lint --fix`
- Type check: `pnpm typecheck`
- DB migrate: `pnpm db:migrate` (Prisma)

## Non-obvious patterns
- API routes use edge runtime, not Node. Do not import Node-only modules in app/api/.
- Auth uses a custom JWT middleware in lib/auth.ts — not next-auth.
- All env vars are validated at startup via lib/env.ts. Add new vars there first.

## Constraints
- Node >= 20 (.nvmrc)
- pnpm only (corepack enforced)
```

**package.json**:
```json
{
  "name": "healthy-app",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "test": "vitest",
    "lint": "eslint . --fix",
    "typecheck": "tsc --noEmit",
    "db:migrate": "prisma migrate dev",
    "db:seed": "tsx prisma/seed.ts"
  },
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.0.0",
    "@prisma/client": "^5.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "vitest": "^2.0.0",
    "eslint": "^9.0.0",
    "prisma": "^5.0.0"
  },
  "packageManager": "pnpm@9.0.0"
}
```

**pnpm-lock.yaml**: Create empty file (just needs to exist for package manager detection).

**.nvmrc**:
```
20
```

**.eslintrc.json**:
```json
{ "extends": "next/core-web-vitals" }
```

**README.md**:
```markdown
# Healthy App
A Next.js application with Prisma.
```

**Create these empty directories** (with a .gitkeep inside each):
- `src/app/`
- `src/lib/`
- `lib/` (with a file `auth.ts` containing just `// auth middleware`)
- `lib/` (with a file `env.ts` containing just `// env validation`)
- `prisma/`

---

### test/fixtures/bloated-repo/

**CLAUDE.md** (should produce many diagnostics):
```markdown
# Project Overview

This is a TypeScript web application built with React 18, Next.js 14, Tailwind CSS, and PostgreSQL. We use Prisma as our ORM and Vitest for testing.

## Tech Stack
- Frontend: React 18 with TypeScript
- Framework: Next.js 14 (App Router)
- Styling: Tailwind CSS
- Database: PostgreSQL with Prisma ORM
- Testing: Vitest + React Testing Library
- Deployment: Vercel

## Project Structure
```
src/
├── app/
│   ├── api/
│   │   ├── auth/
│   │   └── users/
│   ├── dashboard/
│   └── layout.tsx
├── components/
│   ├── ui/
│   └── forms/
├── lib/
│   ├── db.ts
│   ├── auth.ts
│   └── utils.ts
├── hooks/
│   ├── useAuth.ts
│   └── useForm.ts
└── types/
    └── index.ts
```

## Code Style
- Use 2-space indentation
- Prefer const over let
- Use single quotes for strings
- Always add trailing commas
- Use camelCase for variables and functions
- Use PascalCase for components and classes
- Maximum line length: 100 characters
- Always use semicolons

## Getting Started
This project is built with React and Next.js. It uses TypeScript for type safety and Tailwind CSS for styling. The database is PostgreSQL accessed through Prisma ORM.

## Build Commands
- Install: `npm run install`
- Dev: `npm run dev`
- Test: `npm run test:integration`
- Build: `npm run build`
- Lint: `npm run format`

## API Documentation
See the `src/old-api/` directory for API route handlers. The middleware in `src/middleware/legacy-auth.ts` handles authentication.
```

**package.json**:
```json
{
  "name": "bloated-app",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "test": "vitest",
    "test:unit": "vitest --project unit",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.0.0",
    "@prisma/client": "^5.0.0",
    "tailwindcss": "^3.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "vitest": "^2.0.0",
    "eslint": "^9.0.0"
  }
}
```

**pnpm-lock.yaml**: Create empty file.

**.prettierrc**:
```json
{ "semi": true, "singleQuote": true, "tabWidth": 2, "trailingComma": "all" }
```

**README.md**:
```markdown
# Bloated App

This is a TypeScript web application built with React 18, Next.js 14, Tailwind CSS, and PostgreSQL. We use Prisma as our ORM and Vitest for testing.

## Getting Started
Install dependencies and run the development server.
```

Create directories: `src/app/`, `src/components/`, `src/lib/`, `src/hooks/`, `src/types/`  
Do NOT create `src/old-api/` or `src/middleware/` (these should trigger stale-file-ref).

**Expected diagnostics for bloated-repo**:
1. `no-inferable-stack` (warn) — Lines 3, 7-13: tech stack is in package.json
2. `no-directory-tree` (error) — Lines 16-31: embedded directory tree
3. `no-style-guide` (info) — Lines 34-41: style rules belong in .prettierrc (which exists!)
4. `redundant-readme` (warn) — Lines 3 and 44-45: overlap with README.md
5. `stale-command` (error) — "npm run install" (not a valid script), "npm run test:integration" (doesn't exist), "npm run format" (doesn't exist). Also npm vs pnpm mismatch.
6. `stale-file-ref` (error) — `src/old-api/` and `src/middleware/legacy-auth.ts` don't exist
7. `max-lines` (warn) — over 40 non-empty lines (borderline)
8. `token-budget` (warn) — high noise ratio

---

### test/fixtures/stale-repo/

**AGENTS.md**:
```markdown
# AGENTS.md

## Build & test
- Install: `pnpm install`
- Test: `pnpm test:e2e`
- Lint: `pnpm lint:fix`

## Key files
- Auth config: `src/config/auth-config.ts`
- Database: `src/db/connection.ts`
- Main entry: `src/index.ts`
```

**package.json**:
```json
{
  "name": "stale-app",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "test": "vitest",
    "lint": "eslint . --fix"
  },
  "dependencies": {
    "express": "^4.0.0"
  },
  "devDependencies": {
    "tsx": "^4.0.0",
    "vitest": "^2.0.0",
    "eslint": "^9.0.0"
  }
}
```

**pnpm-lock.yaml**: Create empty file.

Create: `src/index.ts` (with `// entry`), `src/db/connection.ts` (with `// db`).
Do NOT create `src/config/auth-config.ts` (should be flagged as stale).

**Expected diagnostics**:
1. `stale-command` (error) — `pnpm test:e2e` doesn't exist (only `test`), `pnpm lint:fix` doesn't exist (only `lint`)
2. `stale-file-ref` (error) — `src/config/auth-config.ts` doesn't exist

---

### test/fixtures/no-context-repo/

**package.json**:
```json
{
  "name": "new-project",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "test": "vitest",
    "lint": "eslint . --fix",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.0.0",
    "react-dom": "^18.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "vite": "^5.0.0",
    "vitest": "^2.0.0",
    "eslint": "^9.0.0",
    "@vitejs/plugin-react": "^4.0.0"
  }
}
```

**pnpm-lock.yaml**: Create empty file.

**README.md**:
```markdown
# New Project
A React app with Vite.
```

Create: `src/App.tsx` (with `// app`), `src/main.tsx` (with `// entry`)

No context file. Used to test `ctxlint init`.

---

## DOGFOODING — ctxlint's Own AGENTS.md

Create this file at the project root:

```markdown
# AGENTS.md

## Build & test
- Install: `npm install`
- Test: `npm test` (vitest)
- Single test: `npx vitest --filter <name>`
- No lint config — use standard JS style

## Architecture
- Rules are in src/rules/. Each exports: { name, severity, description, run(parsedFile, projectData) → Diagnostic[] }
- Test fixtures in test/fixtures/ are real directory structures, not mocks. Tests use the actual filesystem.
- Token estimation uses 4 chars/token heuristic, not a real tokenizer.
- Reporter receives all diagnostics sorted; token-budget rule runs last because it needs other rules' results.

## Constraints
- Zero runtime dependencies beyond commander. Do not add chalk, glob, yaml, or any other packages.
- All file I/O is synchronous (fs.readFileSync). Simpler and fast enough for a linter.
- Must work as `npx ctxlint check` with zero prior install.
- ESM only. All files use import/export.
```

---

## package.json

```json
{
  "name": "ctxlint",
  "version": "0.1.0",
  "description": "Lint AI agent context files. Find what's hurting your AGENTS.md.",
  "type": "module",
  "bin": {
    "ctxlint": "./bin/ctxlint.js"
  },
  "main": "./src/cli.js",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  },
  "keywords": [
    "agents-md", "claude-md", "gemini-md", "context-engineering",
    "ai-coding", "linter", "developer-tools", "token-optimization",
    "coding-agents", "context-files"
  ],
  "author": "",
  "license": "MIT",
  "engines": {
    "node": ">=18"
  },
  "files": [
    "bin/",
    "src/",
    "README.md",
    "LICENSE"
  ],
  "dependencies": {
    "commander": "^12.0.0"
  },
  "devDependencies": {
    "vitest": "^3.0.0"
  }
}
```

---

## vitest.config.js

```javascript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['test/**/*.test.js'],
  },
});
```

---

## .gitignore

```
node_modules/
coverage/
validation-results/
*.bak
```

---

## README.md CONTENT

Write a README.md that includes:

1. **One-line description**: "Lint your AI agent context files. Find stale references, inferable content, and token waste."

2. **Quick start**: 
   ```bash
   npx ctxlint check
   ```

3. **Why this exists**: 2-3 sentences about the ETH Zurich finding. Link to the paper.

4. **What it checks**: Table of all 8 rules with name, severity, and one-line description.

5. **Commands**: `check`, `init`, `slim`, `diff` with usage examples.

6. **Example output**: Show a realistic terminal output from running on the bloated-repo fixture.

7. **CI integration**: GitHub Actions example.

8. **Research**: Citation of both the ETH Zurich paper (arXiv:2602.11988) and Lulla et al. (arXiv:2601.20404).

9. **License**: MIT.

Keep the README under 200 lines. Practice what we preach.

---

## IMPLEMENTATION ORDER

Build in this exact order to have a working tool as early as possible:

### Phase 1 — Skeleton (get `ctxlint check` running with 1 rule)
1. `package.json` and `vitest.config.js`
2. `src/constants.js`
3. `bin/ctxlint.js`
4. `src/cli.js` (commander setup, all 4 commands defined but only check implemented)
5. `src/detector/context-file.js`
6. `src/detector/project.js`
7. `src/parser/context-file.js`
8. `src/rules/stale-file-ref.js` (simplest impactful rule)
9. `src/rules/index.js` (just stale-file-ref for now)
10. `src/reporter/terminal.js`
11. `src/reporter/json.js`
12. `src/commands/check.js`
13. Test fixture: `test/fixtures/stale-repo/` with its files
14. Test: `test/rules/stale-file-ref.test.js`
15. **Checkpoint: `npx . check test/fixtures/stale-repo` should produce output**

### Phase 2 — Core rules
16. `src/rules/no-directory-tree.js` + test
17. `src/rules/stale-command.js` + test
18. `src/rules/no-inferable-stack.js` + test
19. Test fixture: `test/fixtures/bloated-repo/` with its files
20. **Checkpoint: `npx . check test/fixtures/bloated-repo` should produce 6+ diagnostics**

### Phase 3 — Remaining rules
21. `src/rules/redundant-readme.js` + test
22. `src/rules/no-style-guide.js` + test
23. `src/rules/max-lines.js` + test
24. `src/rules/token-budget.js` + test (this rule runs last)
25. Update `src/rules/index.js` with all rules
26. Test fixture: `test/fixtures/healthy-repo/` with its files
27. **Checkpoint: `npx . check test/fixtures/healthy-repo` should produce 0 errors**

### Phase 4 — Additional commands
28. `src/commands/init.js` + test
29. `src/commands/slim.js` + test
30. `src/commands/diff.js` + test
31. Test fixture: `test/fixtures/no-context-repo/`
32. **Checkpoint: `npx . init --dry-run test/fixtures/no-context-repo` should output <40 lines**

### Phase 5 — Polish
33. Integration test: `test/integration/cli.test.js`
34. `AGENTS.md` (dogfooding)
35. `README.md`
36. `LICENSE` (MIT)
37. `.gitignore`
38. Final test run: `npm test` — all green

### Phase 6 — Real-repo validation (run manually after Phase 5)
39. Create `scripts/validate-real-repos.sh`
40. Run: `bash scripts/validate-real-repos.sh`
41. Review each output file in `validation-results/` for false positives
42. Fix any crashes or rules with precision below 80%
43. Re-run until clean
44. **Checkpoint: 0 crashes, >80% precision across all tested repos. Ready to publish.**

---

## CRITICAL IMPLEMENTATION NOTES

1. **The token-budget rule must receive diagnostics from all other rules.** It cannot run independently. The check command should run all other rules first, collect their diagnostics, then pass them to token-budget.run() as an extra parameter. Modify the token-budget rule interface to accept a third parameter: `run(parsedFile, projectData, otherDiagnostics)`.

2. **File path normalization matters.** On Windows, paths use backslashes. Always normalize to forward slashes when comparing context file references against the file system. Use `path.posix.normalize()` or simple `.replace(/\\/g, '/')`.

3. **The project scanner MUST skip node_modules, .git, and similar.** Without this, scanning will be extremely slow on real projects. Hard-code a skip list: `['node_modules', '.git', 'dist', 'build', '.next', '.nuxt', '__pycache__', '.venv', 'venv', 'target', 'vendor', '.cache', 'coverage', '.turbo', '.vercel', '.output']`.

4. **Code blocks in context files must be handled carefully.** Rules should NEVER flag content inside fenced code blocks (``` ... ```), because code examples are legitimate context. The parser must track code block state and every rule must check `isInCodeBlock()` before flagging a line.

5. **Exit codes matter for CI.** `check` must exit 0 if no errors (warnings are OK), exit 1 if any error-severity diagnostics exist. This is critical for the GitHub Action and pre-commit hook use cases.

6. **The `init` command must NEVER generate a directory tree.** That's the whole point of this tool. It generates only non-inferable content: build commands, non-standard patterns, and constraints.

7. **When multiple context files exist (e.g., both AGENTS.md and CLAUDE.md), lint each independently** and add an info diagnostic noting the redundancy: "Multiple context files found. Consider using one source of truth (AGENTS.md) with symlinks."

8. **The trigram overlap for redundant-readme should be case-insensitive and ignore markdown formatting.** Strip `#`, `*`, `_`, `` ` ``, `[`, `]`, `(`, `)` before computing trigrams.

9. **For the `diff` command, if git is not available, print a clear message** saying "Git is required for drift detection" and exit 2. Don't crash with an unhandled error.

10. **All user-facing strings should be in the rule files, not in the reporters.** The reporters just format; the rules provide the content (message + suggestion).

---

## PHASE 6 — REAL-REPO VALIDATION (after all tests pass)

After Phase 5 is complete and all unit/integration tests pass, validate ctxlint against real open-source codebases. This catches edge cases that synthetic fixtures miss: monorepos, Python-only projects, unusual directory structures, massive AGENTS.md files, etc.

### Create scripts/validate-real-repos.sh

```bash
#!/usr/bin/env bash
set -euo pipefail

# This script clones popular open-source repos that have context files
# and runs ctxlint against each one to validate behavior.

REPOS=(
  "https://github.com/vercel/next.js"
  "https://github.com/openai/codex"
  "https://github.com/anthropics/anthropic-cookbook"
  "https://github.com/langchain-ai/langchain"
  "https://github.com/run-llama/llama_index"
  "https://github.com/pydantic/pydantic"
  "https://github.com/astral-sh/ruff"
  "https://github.com/fastapi/fastapi"
)

RESULTS_DIR="validation-results"
mkdir -p "$RESULTS_DIR"
CLONE_DIR=$(mktemp -d)

echo "=== ctxlint real-repo validation ==="
echo "Cloning to: $CLONE_DIR"
echo ""

TOTAL=0
PASSED=0
CRASHED=0

for REPO_URL in "${REPOS[@]}"; do
  REPO_NAME=$(basename "$REPO_URL")
  echo "--- $REPO_NAME ---"
  
  # Shallow clone (fast, only need current state)
  if git clone --depth 1 --quiet "$REPO_URL" "$CLONE_DIR/$REPO_NAME" 2>/dev/null; then
    TOTAL=$((TOTAL + 1))
    
    # Check if any context file exists
    CONTEXT_FILE=""
    for f in AGENTS.md CLAUDE.md GEMINI.md .cursorrules; do
      if [ -f "$CLONE_DIR/$REPO_NAME/$f" ]; then
        CONTEXT_FILE="$f"
        break
      fi
    done
    
    if [ -z "$CONTEXT_FILE" ]; then
      echo "  No context file found. Testing init command..."
      node ./bin/ctxlint.js init --dry-run "$CLONE_DIR/$REPO_NAME" \
        > "$RESULTS_DIR/${REPO_NAME}-init.txt" 2>&1 || true
      echo "  init output saved to $RESULTS_DIR/${REPO_NAME}-init.txt"
    else
      echo "  Found: $CONTEXT_FILE ($(wc -l < "$CLONE_DIR/$REPO_NAME/$CONTEXT_FILE") lines)"
      
      # Run check with JSON output for analysis
      if node ./bin/ctxlint.js check --format json "$CLONE_DIR/$REPO_NAME" \
        > "$RESULTS_DIR/${REPO_NAME}-check.json" 2>&1; then
        PASSED=$((PASSED + 1))
        echo "  ✓ check completed (exit 0 — no errors)"
      else
        EXIT_CODE=$?
        if [ $EXIT_CODE -eq 1 ]; then
          PASSED=$((PASSED + 1))
          # Extract summary from JSON
          ERRORS=$(node -e "const r=JSON.parse(require('fs').readFileSync('$RESULTS_DIR/${REPO_NAME}-check.json','utf8'));console.log(r.summary?.errors||0)" 2>/dev/null || echo "?")
          WARNINGS=$(node -e "const r=JSON.parse(require('fs').readFileSync('$RESULTS_DIR/${REPO_NAME}-check.json','utf8'));console.log(r.summary?.warnings||0)" 2>/dev/null || echo "?")
          echo "  ✓ check completed (exit 1 — $ERRORS errors, $WARNINGS warnings)"
        else
          CRASHED=$((CRASHED + 1))
          echo "  ✗ CRASHED (exit $EXIT_CODE)"
          # Save stderr for debugging
          node ./bin/ctxlint.js check "$CLONE_DIR/$REPO_NAME" \
            > "$RESULTS_DIR/${REPO_NAME}-crash.txt" 2>&1 || true
        fi
      fi
      
      # Also run terminal output for human review
      node ./bin/ctxlint.js check "$CLONE_DIR/$REPO_NAME" \
        > "$RESULTS_DIR/${REPO_NAME}-check.txt" 2>&1 || true
    fi
  else
    echo "  ✗ Clone failed (repo may be private or renamed)"
  fi
  
  echo ""
done

# Cleanup
rm -rf "$CLONE_DIR"

echo "=== Summary ==="
echo "Repos tested: $TOTAL"
echo "Completed without crash: $PASSED"
echo "Crashed: $CRASHED"
echo ""
echo "Results saved to $RESULTS_DIR/"
echo ""
echo "Next steps:"
echo "1. Review each *-check.txt file for false positives"
echo "2. If any crashes occurred, fix the bug and re-run"
echo "3. Record precision: (true positives) / (total flagged)"
echo "   Target: >80% precision before publishing"
```

Make this file executable: `chmod +x scripts/validate-real-repos.sh`

### What to check in the validation results

For each repo, open the `-check.txt` file and manually review every diagnostic:

**True positive**: ctxlint flagged content that is genuinely inferable, stale, or redundant. The diagnostic is correct. Mark as TP.

**False positive**: ctxlint flagged content that is actually non-inferable and valuable. This means a rule is too aggressive. Mark as FP and note which rule.

**Record results in a table**:

| Repo | Context file | Lines | Diagnostics | TP | FP | Precision | Crashed |
|------|-------------|-------|-------------|----|----|-----------|---------|
| next.js | AGENTS.md | ? | ? | ? | ? | ?% | No |
| codex | AGENTS.md | ? | ? | ? | ? | ?% | No |
| ... | ... | ... | ... | ... | ... | ... | ... |

**Target before publishing**: >80% precision (fewer than 1 in 5 diagnostics is a false positive) and 0 crashes across all tested repos.

**If precision is below 80%**: Identify which rule causes the most false positives and tighten its detection logic. Common fixes:
- `stale-file-ref`: Add more patterns to the skip list (package names mistaken for file paths)
- `no-inferable-stack`: Add more "don't flag" conditions for qualified statements ("because...", "unlike...")
- `redundant-readme`: Raise the trigram overlap threshold from 0.40 to 0.50

### Update the project structure to include the validation script

Add to the project structure:
```
ctxlint/
├── scripts/
│   └── validate-real-repos.sh      # Real-repo validation script
├── validation-results/              # gitignored — validation output
...
```

Add `validation-results/` to `.gitignore`.
