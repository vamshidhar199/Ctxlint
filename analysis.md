# Validation Analysis & Known Limitations

Last validated: 2026-04-05 against 8 real-world repos (shallow clones).
Current precision: ~88% across 5 repos with context files.

---

## Known limitations open for contribution

These are confirmed gaps identified during real-repo validation. Each is a good starting point for contributors.

### 1. Monorepo path resolution (`stale-file-ref`)

**Problem:** In monorepos, context files at the repo root reference paths relative to a sub-package (e.g. `src/cli/next-dev.ts` in next.js means `packages/next/src/cli/next-dev.ts`). ctxlint currently flags these as stale even though the file exists — it just has a monorepo prefix.

**Current behavior:** Flags as `error` with a "did you mean `packages/next/src/cli/next-dev.ts`?" suggestion.

**Desired behavior:** Detect when the queried path is a suffix of an existing file and downgrade to `warn` with a message like "path needs monorepo prefix — update to `packages/next/src/cli/next-dev.ts`".

**Where to fix:** `src/rules/stale-file-ref.js` → `findFileSuggestion()` and `checkPath()`

**Affected repos:** next.js, codex, langchain

---

### 2. Non-JS ecosystem support (`stale-command`, `init`)

**Problem:** `stale-command` and `init` are optimized for npm/pnpm/yarn projects. Rust, Go, and Python projects get partial coverage — Makefile targets are detected but `Cargo.toml`, `pyproject.toml`, and `go.mod` scripts are not.

**Current behavior:** Python/Rust/Go projects may get no build commands in `init` output, and `stale-command` won't catch stale `cargo`, `go`, or `uv` commands.

**Desired behavior:**
- `init` should detect and list `cargo build/test/clippy`, `go build/test`, `uv run/pytest` etc.
- `stale-command` should validate commands against `Cargo.toml`, `pyproject.toml`, `go.mod`

**Where to fix:** `src/commands/init.js` → add Python/Rust/Go script detection; `src/rules/stale-command.js` → add non-JS command validators

**Affected repos:** ruff, langchain (Python), codex (Rust)

---

### 3. Semantic staleness (`stale-file-ref`)

**Problem:** Rules check structural correctness (does the file exist?) but not semantic freshness (is the description of that file still accurate?). A file can exist but have been completely rewritten since the context file was last updated.

**Current behavior:** No semantic drift detection — only structural checks.

**Desired behavior:** Flag when a referenced file has changed significantly since the context file was last committed (via `git diff`).

**Where to fix:** `src/commands/diff.js` already has partial git-diff logic — extend it to detect semantic staleness in `check` as well.

---

### 4. `redundant-readme` borderline case (ruff)

**Problem:** ruff's "Development Guidelines" section was flagged at ~45% trigram overlap with the README "Rules" section. Manual review needed to confirm whether this is a true positive or the trigram threshold is too low for technical content.

**Current behavior:** Flagged as `warn`.

**Desired behavior:** Investigate whether the 40% threshold (`TRIGRAM_OVERLAP_THRESHOLD`) should be raised for repos with highly technical/domain-specific vocabulary, where common technical terms inflate overlap scores.

**Where to fix:** `src/constants.js` → `THRESHOLDS.TRIGRAM_OVERLAP_THRESHOLD`; `src/rules/redundant-readme.js`

---

### 5. Token cost assumptions (`token-budget`)

**Problem:** The cost projection is hardcoded for Claude Sonnet pricing at 5 developers, 20 sessions/day. This may not reflect every team's actual usage or model choice.

**Desired behavior:** Allow configuration via a `ctxlint.config.js` or CLI flags (e.g. `--team-size`, `--sessions-per-day`).

**Where to fix:** `src/rules/token-budget.js` → accept config params; `src/cli.js` → expose flags

---

## False positive history

| Repo | Diagnostic | Classification | Fix applied |
|------|-----------|---------------|-------------|
| codex | `stale-file-ref` `target/` | FP | Skip generated dir segments |
| langchain | `stale-file-ref` `../langchain-google/` | FP | Skip `../` parent-relative paths |
| langchain | `no-inferable-stack` docstring convention | FP | Added `docstring` to exception patterns |
| next.js | `stale-file-ref` `dist/`, `node_modules/`, `.next/` | FP | Skip generated dir segments |
| next.js | `stale-file-ref` `react-dom/server.edge` | FP | Added npm subpath import guard |
| ruff | `no-style-guide` naming convention description | FP | Tightened pattern to require line-start directive verb |

## Precision

| | Count |
|---|---|
| Total diagnostics emitted (unique files) | ~33 |
| False positives before fixes | ~12 |
| Precision before fixes | ~68% |
| False positives after fixes | ~2 borderline |
| Precision after fixes | ~91% |

Target was >80% before publishing. ✓
