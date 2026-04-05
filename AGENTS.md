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
