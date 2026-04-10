# AGENTS.md

## Build & test
- Install: `npm install`
- Test: `npm test` (vitest, 118 tests)
- Single test: `npx vitest --filter <name>`
- No lint config — use standard JS style

## Architecture

### Configuration
- Project-level config lives in .ctxlintrc or .ctxlintrc.json at the project root.
- `src/config.js` loads and merges config with defaults. Fields: `checks`, `ignore`, `strict`, `contextFiles`, `tokenThresholds`.
- CLI flags always override .ctxlintrc settings.
- `--strict` mode exits 1 on warnings (not just errors). Can be set in `.ctxlintrc` or via CLI.

### Context file linting
- Rules live in `src/rules/`. Each exports: `{ name, severity, description, run(parsedFile, projectData) → Diagnostic[] }`
- `token-budget` runs last in `check.js` — it receives all other diagnostics to calculate signal-to-noise ratio.
- Supported context files: AGENTS.md, CLAUDE.md, GEMINI.md, .github/copilot-instructions.md, .windsurfrules, .clinerules, .aiderules, CONVENTIONS.md — defined in `src/constants.js`. Additional files can be added via the contextFiles field in .ctxlintrc.
- Test fixtures in `test/fixtures/` are real directory structures, not mocks. Tests use the actual filesystem.
- Token estimation uses 4 chars/token heuristic, not a real tokenizer.

### MCP config linting
- MCP rules live in `src/rules/mcp/`. Each exports: `{ name, severity, description, run(parsedConfig) → Diagnostic[] }`
- MCP diagnostics have `{ rule, severity, server, field, message, suggestion }` — note `server` and `field` instead of `line`.
- MCP config detection in `src/detector/mcp.js` — checks for .mcp.json, .cursor/mcp.json, .vscode/mcp.json, and .amazonq/mcp.json in the project root.
- `mcp-env-syntax` rule validates that env var references use the correct syntax per client: VS Code requires `${env:VAR}`, not `${VAR}`. Rule receives `configName` (the file path) to determine the client.
- MCP reporter in `src/reporter/mcp-terminal.js` (terminal + JSON).

### Commands
- `check` — lints context files. Supports `--format terminal|json|sarif`, `--watch`, and `--strict`.
- `mcp` — lints MCP config files. Supports `--format terminal|json`.
- `init` — generates a minimal context file from project metadata.
- `slim` — removes error-severity flagged content in place.
- `diff` — finds drift between context file and git history.

### Watch mode
- `--watch` uses Node's built-in `fs.watch` (no new deps).
- 300ms debounce handles rapid editor saves.
- Only works with `terminal` format.

### SARIF output
- `src/reporter/sarif.js` accumulates results across all files, then `flushSarif()` emits one document at the end.
- Severity mapping: `error → error`, `warn → warning`, `info → note`.

## Constraints
- Zero runtime dependencies beyond commander. Do not add chalk, glob, yaml, or any other packages.
- All file I/O is synchronous (`fs.readFileSync`). Simpler and fast enough for a linter.
- Must work as `npx @ctxlint/ctxlint check` with zero prior install.
- ESM only. All files use `import/export`.
