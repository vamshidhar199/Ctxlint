# ctxlint

Lint your AI agent context files. Find stale references, inferable content, and token waste.

```bash
npx @ctxlint/ctxlint check
```

> **Early-stage project — contributions welcome.** The rules work well on real repos, but there are edge cases (monorepos, unusual project layouts) where precision can be improved. If you hit a false positive or missing check, please open an issue or PR.

## Why this exists

An ETH Zurich study ([arXiv:2602.11988](https://arxiv.org/abs/2602.11988), Feb 2026) found that bloated context files reduce AI coding agent task success by 3% while increasing costs by 20%. A follow-up study by Lulla et al. ([arXiv:2601.20404](https://arxiv.org/abs/2601.20404)) found that 100% of auto-generated context files contain directory trees that agents never use. ctxlint operationalizes these findings: it tells you what to **remove**, not what to add.

## What it checks

| Rule | Severity | Description |
|------|----------|-------------|
| `stale-file-ref` | error | References to files/directories that don't exist |
| `stale-command` | error | Build commands that don't match package.json scripts |
| `no-directory-tree` | error | Embedded directory tree structures agents ignore |
| `redundant-readme` | warn | Content that overlaps with README.md |
| `no-inferable-stack` | warn | Tech stack discoverable from package.json/tsconfig |
| `max-lines` | warn/error | Files over 200 lines almost always contain bloat |
| `no-style-guide` | info | Style rules that belong in a linter, not a context file |
| `token-budget` | warn | Token cost estimate and signal-to-noise ratio |

## Quick start

```bash
# Check for issues in the current directory
npx @ctxlint/ctxlint check

# Check a specific project
npx @ctxlint/ctxlint check /path/to/project

# Output machine-readable JSON (for CI)
npx @ctxlint/ctxlint check --format json

# Only show warnings and errors (hide info)
npx @ctxlint/ctxlint check --severity warn
```

## Commands

### `check` — lint your context file

```bash
ctxlint check [path] [--format terminal|json] [--severity info|warn|error]
```

Exits 0 if no errors, 1 if errors found (suitable for CI).

### `init` — generate a minimal context file

```bash
ctxlint init [path] [--format agents|claude|gemini|all] [--dry-run] [--force]
```

Generates a context file from your project metadata. Only includes non-inferable content: build commands, non-standard patterns, and version constraints. Never generates a directory tree.

```bash
# Preview without writing
ctxlint init --dry-run

# Write AGENTS.md
ctxlint init

# Write all three formats
ctxlint init --format all
```

### `slim` — remove flagged content

```bash
ctxlint slim <file> [--dry-run] [--backup]
```

Removes all error-severity issues from a context file in place.

```bash
# Preview what would be removed
ctxlint slim --dry-run AGENTS.md

# Remove flagged content (keep a backup)
ctxlint slim --backup AGENTS.md
```

### `diff` — detect drift since last update

```bash
ctxlint diff [path] [--since <ref>] [--fail-on-stale]
```

Finds references in your context file that have gone stale since it was last updated.

```bash
# Check for drift since AGENTS.md was last committed
ctxlint diff

# Check against a specific git ref
ctxlint diff --since main

# Exit 1 if any drift (for CI pre-commit hooks)
ctxlint diff --fail-on-stale
```

## Example output

Running `ctxlint check` on a typical over-specified context file:

```
CLAUDE.md

  ✗ no-directory-tree  Lines 14-34 contain a directory tree (21 lines, ~72 tokens).
     Agents discover file structure via ls/find on their own.

  ✗ stale-command  `npm run test:integration` — script "test:integration" does not exist in package.json
     Available scripts: dev, build, test, lint, typecheck

  ✗ stale-file-ref  references `src/old-api/` but this file does not exist
     Stale references actively mislead agents into searching for non-existent files.

  ⚠ no-inferable-stack  "This is a TypeScript web application built with React 18..."
     Agents infer the tech stack automatically. Keep only non-obvious constraints.

  ℹ no-style-guide  "- Prefer const over let" — your .prettierrc already enforces this
     Agents follow formatter output, not prose instructions.

  ⚠ token-budget  Context file: 58 lines, ~366 tokens
     Signal-to-noise ratio: 0.00 (very poor)
     Estimated monthly cost (5 developers): $0.32 → $0.00 after fixes

Summary:
  6 errors, 5 warnings, 7 info
```

## CI integration

### GitHub Actions

```yaml
name: Lint context file
on: [push, pull_request]

jobs:
  ctxlint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npx @ctxlint/ctxlint check --severity warn
```

### Pre-commit hook

```bash
# .git/hooks/pre-commit
npx @ctxlint/ctxlint diff --fail-on-stale
```

## Current limitations

ctxlint is useful today but not exhaustive. Known gaps:

- **Monorepo path resolution** — paths written relative to a sub-package (e.g. `src/` in a `packages/foo/` workspace) are flagged as stale even though they're valid within that package's context.
- **Non-JS ecosystems** — `stale-command` and `init` are optimized for npm/pnpm/yarn projects. Rust, Go, and Python projects get partial coverage.
- **Semantic staleness** — rules check structural correctness (does the file exist?), not semantic freshness (is the description still accurate?).
- **Precision target** — validated at ~91% precision across 5 real-world repos. Some false positives remain in unusual project layouts.

See [`analysis.md`](./analysis.md) for the full false-positive breakdown from real-repo validation.

## Contributing

Contributions are very welcome — this project is at an early stage and the goal is to grow it into a robust, community-maintained tool.

**Good first issues:**
- Add a rule for a pattern you've seen in real context files
- Improve monorepo path resolution in `stale-file-ref`
- Add `stale-command` support for `Makefile`, `pyproject.toml`, or `Cargo.toml`
- Improve `init` output for Python/Rust/Go projects

**How to contribute:**
1. Fork and clone the repo
2. `npm install`
3. Write your rule in `src/rules/` — each rule exports `{ name, severity, description, run(parsedFile, projectData) → Diagnostic[] }`
4. Add tests in `test/rules/` and a fixture in `test/fixtures/` if needed
5. Run `npm test` — all 110 tests must pass
6. Open a PR

See `AGENTS.md` for architecture notes and project conventions.

## Installing

```bash
# Run without installing
npx @ctxlint/ctxlint check

# Or install globally
npm install -g @ctxlint/ctxlint
ctxlint check
```

## Research

- **ETH Zurich (2026)**: [Automated Coding Agents Context Files: arXiv:2602.11988](https://arxiv.org/abs/2602.11988) — bloated context files reduce agent performance by 3%, increase costs by 20%.
- **Lulla et al. (2026)**: [Context Engineering for Coding Agents: arXiv:2601.20404](https://arxiv.org/abs/2601.20404) — 100% of auto-generated context files contain unused directory trees.

## License

MIT © Vamshidhar Reddy Parupally
