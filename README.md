# ctxlint

[![npm version](https://img.shields.io/npm/v/@ctxlint/ctxlint)](https://www.npmjs.com/package/@ctxlint/ctxlint)
[![npm downloads](https://img.shields.io/npm/dt/@ctxlint/ctxlint)](https://www.npmjs.com/package/@ctxlint/ctxlint)
[![CI](https://github.com/ctxlint/Ctxlint/actions/workflows/ci.yml/badge.svg)](https://github.com/ctxlint/Ctxlint/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/@ctxlint/ctxlint)](./LICENSE)
[![dependencies: 1](https://img.shields.io/badge/dependencies-1-brightgreen)](./package.json)
[![tests: 118 passing](https://img.shields.io/badge/tests-118%20passing-brightgreen)](#)
[![GitHub Marketplace](https://img.shields.io/badge/GitHub%20Marketplace-ctxlint-blue?logo=github)](https://github.com/marketplace/actions/ctxlint)

**The linter for AI agent context files and MCP configs.**

Lint `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `.windsurfrules`, `.clinerules`, `.aiderules`, `CONVENTIONS.md`, `.cursorrules`, and `.mcp.json`. Catch stale file references, dead build commands, hardcoded secrets, token waste, and more — before they hurt your agent.

```bash
npx @ctxlint/ctxlint check
```

---

## Why your context file is probably hurting your agent

Research from ETH Zurich ([Gloaguen et al., 2026](https://arxiv.org/abs/2602.11988)) found that bloated context files **reduce task success rates and increase inference costs by over 20%**. References to files that no longer exist, commands that don't match your package.json, directory trees the agent regenerates anyway — all of it is noise that degrades performance.

ctxlint finds that noise and helps you remove it.

---

## What makes ctxlint different

| | ctxlint | others |
|---|---|---|
| Runtime dependencies | **1** (commander only) | 5–9 |
| Commands | **check, init, slim, diff, mcp** | check only |
| Auto-fix | **✓ `slim` removes flagged content** | ✗ |
| Generates context files | **✓ `init` from project metadata** | ✗ |
| Drift detection | **✓ `diff` via git history** | ✗ |
| MCP config validation | **✓ secrets, localhost, SSE, env syntax** | ✗ |
| Watch mode | **✓ `--watch` re-lints on save** | ✗ |
| SARIF output | **✓ GitHub Code Scanning** | ✗ |
| Multi-language | **✓ JS, Rust, Go, Python** | JS only |
| Config file | **✓ `.ctxlintrc` per-project config** | ✗ |
| Strict mode | **✓ `--strict` exits 1 on warnings** | ✗ |
| Research-backed rules | **✓ cited papers** | ✗ |
| Validated precision | **~91% on real repos** | unknown |

---

## Install

```bash
# Run without installing (zero setup)
npx @ctxlint/ctxlint check

# Or install globally
npm install -g @ctxlint/ctxlint
ctxlint check
```

---

## Commands

### `check` — lint your context file

```bash
ctxlint check [path] [--format terminal|json|sarif] [--severity info|warn|error] [--watch] [--strict]
```

Runs all rules against every context file found in the project. Exits `0` if no errors, `1` if errors found — suitable for CI.

```bash
# Lint current directory
ctxlint check

# Only show warnings and errors
ctxlint check --severity warn

# Exit 1 on warnings too (stricter CI enforcement)
ctxlint check --strict

# Machine-readable JSON for scripts
ctxlint check --format json

# SARIF for GitHub Code Scanning
ctxlint check --format sarif > results.sarif

# Re-lint on every save (great during active editing)
ctxlint check --watch
```

### `mcp` — validate MCP server configs

```bash
ctxlint mcp [path] [--format terminal|json] [--severity info|warn|error]
```

Validates `.mcp.json`, `.cursor/mcp.json`, `.vscode/mcp.json`, and `.amazonq/mcp.json`. Catches hardcoded secrets, localhost URLs, deprecated SSE transport, and missing server definitions.

```bash
# Check current directory
ctxlint mcp

# Machine-readable output for CI
ctxlint mcp --format json
```

### `init` — generate a minimal context file

```bash
ctxlint init [path] [--format agents|claude|gemini|all] [--dry-run] [--force]
```

Generates a context file from your project metadata. Only includes non-inferable content: build commands, version constraints, and non-standard patterns. Never emits a directory tree. Supports JS, Rust, Go, and Python projects.

```bash
# Preview without writing
ctxlint init --dry-run

# Write AGENTS.md (default)
ctxlint init

# Write all three formats at once
ctxlint init --format all
```

### `slim` — auto-fix flagged content

```bash
ctxlint slim <file> [--dry-run] [--backup]
```

Automatically removes all `error`-severity issues from a context file in place. The only context file linter with auto-fix.

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

Compares your context file against git history to find references that have gone stale since the file was last updated.

```bash
# Check for drift since AGENTS.md was last committed
ctxlint diff

# Check against a specific git ref
ctxlint diff --since main

# Exit 1 if any drift (for pre-commit hooks)
ctxlint diff --fail-on-stale
```

---

## What it checks

### Context file rules

| Rule | Severity | Description |
|------|----------|-------------|
| `stale-file-ref` | error / warn | References to files/dirs that don't exist. Downgrades to `warn` for monorepo prefix mismatches. |
| `stale-command` | error | Build commands that don't match package.json scripts, Makefile targets, Cargo.toml, go.mod, or pyproject.toml |
| `no-directory-tree` | error | Embedded directory trees — agents regenerate these on their own |
| `redundant-readme` | warn | Content that duplicates README.md (trigram overlap) |
| `no-inferable-stack` | warn | Tech stack descriptions discoverable from package.json / tsconfig / Cargo.toml |
| `max-lines` | warn / error | Files over 200 lines almost always contain bloat |
| `no-style-guide` | info | Style rules that belong in a linter config, not a context file |
| `token-budget` | warn | Token cost estimate, signal-to-noise ratio, and monthly savings projection |
| `ci-coverage` | info | CI workflows in `.github/workflows/` not mentioned in the context file |

### MCP config rules

| Rule | Severity | Description |
|------|----------|-------------|
| `mcp-schema` | error | `mcpServers` root key missing or malformed |
| `mcp-missing-command` | error | Server definition has neither `command` nor `url` — can't start |
| `mcp-hardcoded-secret` | error | API keys or tokens hardcoded in `env` blocks |
| `mcp-localhost-url` | warn | `url` points to localhost — only works on one machine |
| `mcp-deprecated-transport` | warn | SSE transport deprecated in MCP spec 2025-03-26 |
| `mcp-env-syntax` | warn | Env var references use wrong syntax for the client (e.g. `${VAR}` instead of `${env:VAR}` in VS Code) |

---

## Example output

### `ctxlint check`

```
CLAUDE.md

  ✗ no-directory-tree  Lines 14-34 contain a directory tree (21 lines, ~72 tokens)
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
     Signal-to-noise ratio: 0.41 (poor)
     Estimated monthly cost (5 developers): $0.32 → $0.00 after fixes

Summary:
  3 errors, 2 warnings, 1 info
```

### `ctxlint mcp`

```
.mcp.json

  ✗ mcp-hardcoded-secret  `openai-tools.env.OPENAI_API_KEY` appears to contain a hardcoded secret
     Use an environment variable reference instead: "OPENAI_API_KEY": "${OPENAI_API_KEY}"

  ⚠ mcp-localhost-url  `local-search.url` points to localhost (http://localhost:8080/mcp)
     Localhost URLs only work on your machine.

  ⚠ mcp-deprecated-transport  `local-search.transport` uses deprecated SSE transport
     SSE was deprecated in MCP spec 2025-03-26. Remove the transport field — HTTP is now the default.

Summary:
  1 error, 2 warnings, 0 info
```

---

## Configuration

Create a `.ctxlintrc` (or `.ctxlintrc.json`) file in your project root to configure ctxlint per-project:

```json
{
  "checks": ["stale-file-ref", "stale-command", "no-directory-tree"],
  "ignore": ["no-style-guide"],
  "strict": false,
  "contextFiles": ["CUSTOM_AGENTS.md"],
  "tokenThresholds": {
    "info": 500,
    "warning": 2000,
    "error": 5000
  }
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `checks` | `string[]` or `null` | `null` (all) | Whitelist of rules to run. `null` runs all rules. |
| `ignore` | `string[]` | `[]` | Rules to skip entirely. |
| `strict` | `boolean` | `false` | Exit 1 on warnings, not just errors. Overridden by `--strict` CLI flag. |
| `contextFiles` | `string[]` | `[]` | Additional context file names to lint beyond the defaults. |
| `tokenThresholds.info` | `number` | `500` | Line count threshold for `info` severity in `token-budget`. |
| `tokenThresholds.warning` | `number` | `2000` | Line count threshold for `warn` severity in `token-budget`. |
| `tokenThresholds.error` | `number` | `5000` | Line count threshold for `error` severity in `token-budget`. |

CLI flags always take precedence over `.ctxlintrc` settings.

---

## CI integration

### GitHub Actions — Marketplace action (recommended)

```yaml
name: Lint context file
on: [push, pull_request]

jobs:
  ctxlint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ctxlint/ctxlint-action@v1
```

Fail on warnings too:

```yaml
      - uses: ctxlint/ctxlint-action@v1
        with:
          strict: true
```

Lint a subdirectory (e.g. in a monorepo):

```yaml
      - uses: ctxlint/ctxlint-action@v1
        with:
          path: ./packages/my-agent
```

**Inputs**

| Input | Default | Description |
|-------|---------|-------------|
| `path` | `.` | Project directory to scan |
| `strict` | `false` | Exit 1 on warnings in addition to errors |
| `fail-on-warnings` | `false` | Alias for `strict` |

**Outputs**

| Output | Description |
|--------|-------------|
| `issues-found` | Total number of issues detected |
| `exit-code` | Raw exit code returned by ctxlint |

---

### GitHub Actions — with Code Scanning (SARIF)

```yaml
name: Lint context file
on: [push, pull_request]

jobs:
  ctxlint:
    runs-on: ubuntu-latest
    permissions:
      security-events: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npx @ctxlint/ctxlint check --format sarif > ctxlint.sarif
      - uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: ctxlint.sarif
```

### Pre-commit hook

```bash
# .git/hooks/pre-commit
npx @ctxlint/ctxlint diff --fail-on-stale
npx @ctxlint/ctxlint mcp
```

---

## Language support

ctxlint is an npm CLI that works on **any project**, regardless of language.

| Ecosystem | `check` | `init` |
|-----------|---------|--------|
| Node.js (npm/yarn/pnpm/bun) | Validates scripts, detects PM mismatch | Generates commands from package.json |
| Rust (Cargo) | Flags `cargo` commands if no `Cargo.toml` | Generates `cargo build/test/clippy` |
| Go | Flags `go` commands if no `go.mod` | Generates `go build/test/fmt ./...` |
| Python (uv/poetry/pip) | Flags `uv run`/`pytest` if no Python files | Generates `uv run pytest` / `poetry run pytest` |
| Makefile (any language) | Validates `make <target>` against Makefile | Lists Makefile targets |

---

## Current limitations

- **Semantic staleness** — rules check whether a file *exists*, not whether its *description* is still accurate.
- **Precision** — validated at ~91% on 5 real-world repos. Some false positives remain in unusual project layouts.

See [`analysis.md`](./analysis.md) for the full false-positive breakdown.

---

## Contributing

Contributions are welcome — the goal is to make ctxlint the standard linter for AI agent context files.

**Good first issues:**
- Add a new MCP rule (e.g. cross-client config consistency, duplicate server detection)
- Improve semantic staleness detection in `diff`
- Improve token cost configuration (`--team-size`, `--sessions-per-day`)
- Add `.ctxlintrc` validation (schema errors for unknown fields)

**How to contribute:**
1. Fork and clone the repo
2. `npm install`
3. Write your rule in `src/rules/` — each rule exports `{ name, severity, description, run(parsedFile, projectData) → Diagnostic[] }`
4. Add tests in `test/rules/` and a fixture in `test/fixtures/` if needed
5. Run `npm test` — all tests must pass
6. Open a PR

See `AGENTS.md` for architecture notes and project conventions.

---

## Research

- **Gloaguen et al. (2026)**: [Evaluating AGENTS.md: Are Repository-Level Context Files Helpful for Coding Agents? arXiv:2602.11988](https://arxiv.org/abs/2602.11988) — bloated context files reduce task success rates and increase inference cost by over 20%.
- **Lulla et al. (2026)**: [On the Impact of AGENTS.md Files on the Efficiency of AI Coding Agents: arXiv:2601.20404](https://arxiv.org/abs/2601.20404) — well-structured context files correlate with ~28% lower runtime and ~16% reduced token consumption.

---

## License

MIT © Vamshidhar Reddy Parupally
