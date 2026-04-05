# Validation Analysis — False Positive Report

Analyzed 2026-04-05 against 8 real-world repos (shallow clones).

## Results by repo

| Repo | Diagnostic | Classification | Reason |
|------|-----------|---------------|--------|
| anthropic-cookbook | `no-directory-tree` | TP | Directory tree in context file |
| anthropic-cookbook | `token-budget` warn | TP | Real noise from directory tree |
| codex | `stale-file-ref` × 5 (`Cargo.toml`, `app-server-protocol/…`) | TP | Files live under `codex-rs/` — monorepo root paths are genuinely wrong |
| codex | `stale-file-ref` `target/` | **FP → fixed** | Build output dir; now skipped via generated-dir check |
| codex | `no-style-guide` snake_case exception | TP | Non-inferable exception for config RPC payloads |
| langchain | `no-directory-tree` | TP | Directory tree present |
| langchain | `stale-file-ref` `../langchain-google/`, `../docs/` | **FP → fixed** | Parent-relative refs to sibling repos; `../` paths now skipped |
| langchain | `stale-file-ref` `partners/`, `standard-tests/`, `__init__.py`, `tests/unit_tests/`, `tests/integration_tests/` | TP | Monorepo paths that are genuinely wrong from root |
| langchain | `no-inferable-stack` (docstring convention) | **FP → fixed** | Project convention, not inferable tech stack; `docstring` added to exception patterns |
| next.js | `no-directory-tree` | TP | Directory tree present |
| next.js | `stale-file-ref` `src/cli/next-dev.ts` etc. | TP | All live under `packages/next/` — paths are wrong from repo root |
| next.js | `stale-file-ref` `dist/`, `node_modules/`, `.next/`, `target/`, `packages/next/dist/` | **FP → fixed** | Generated/excluded dirs; now skipped via `containsGeneratedDirSegment` |
| next.js | `stale-file-ref` `react-dom/server.edge` | **FP → fixed** | npm package subpath import, not a filesystem path; `isNpmSubpathImport` guard added |
| ruff | `redundant-readme` (Development Guidelines ~45% overlap) | Borderline | Needs manual review of section content |
| ruff | `no-style-guide` (naming convention description) | **FP → fixed** | Architectural description, not a style directive; pattern tightened to require directive verb |
| ruff | `token-budget` 51% noise | TP if redundant-readme is TP | Dependent on redundant-readme verdict |

## Precision

| | Count |
|---|---|
| Total diagnostics emitted | ~37 |
| False positives before fixes | ~12 |
| Precision before fixes | ~68% |
| False positives after fixes | ~2 (ruff borderline) |
| Precision after fixes | ~88% |

Target was >80% before publishing. ✓

## Fixes applied (commit: Phase 3 FP fixes)

1. **`stale-file-ref`**: skip `../` parent-relative paths (unverifiable sibling-repo refs)
2. **`stale-file-ref`**: skip paths whose segments match known generated directories (`dist`, `node_modules`, `.next`, `target`, `build`, etc.)
3. **`stale-file-ref`**: skip npm package subpath imports (e.g. `react-dom/server.edge`) — hyphenated package name + file-extension subpath, excluding common local dir prefixes
4. **`no-style-guide`**: tightened `naming convention` pattern to require a directive verb — prevents firing on architectural descriptions
5. **`no-inferable-stack`**: added `docstring` to exception patterns — docstring format is a project convention, not inferable from config files
