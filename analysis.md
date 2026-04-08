# Validation Analysis & Known Limitations

Last validated: 2026-04-05 against 8 real-world repos (shallow clones).
Current precision: ~91% across 5 repos with context files.

---

## Fixed gaps

### 1. Monorepo path resolution (`stale-file-ref`) ✓ Fixed in 1.0.3

**Was:** Paths like `src/cli/next-dev.ts` were flagged as `error` even when the file exists at `packages/next/src/cli/next-dev.ts`.

**Now:** `findFileSuggestion()` checks for suffix matches before basename matches. When a path is a suffix of an existing file, ctxlint emits `warn` (not `error`) with the message: "`src/cli/next-dev.ts` needs a monorepo prefix — update to `packages/next/src/cli/next-dev.ts`".

**Affected repos:** next.js, codex, langchain

---

### 2. Non-JS ecosystem support (`stale-command`, `init`) ✓ Fixed in 1.0.3

**Was:** `stale-command` and `init` were JS-only. Rust/Go/Python projects got no validation or generated commands.

**Now:**
- `src/detector/project.js` detects `Cargo.toml` (`hasCargo`), `go.mod` (`goModule`), and `pyproject.toml` scripts (`pythonScripts`)
- `stale-command` flags `cargo`/`go`/`uv`/`poetry`/`pytest` commands when the corresponding project file is absent
- `init` generates `cargo build/test/clippy` for Rust, `go build/test/fmt ./...` for Go, and `uv run pytest` / `poetry run pytest` / `python -m pytest` for Python

**Affected repos:** ruff, langchain (Python), codex (Rust)

---

## Remaining known limitations open for contribution

### 3. Semantic staleness (`stale-file-ref`) — open

**Problem:** Rules check structural correctness (does the file exist?) but not semantic freshness (is the description of that file still accurate?). A file can exist but have been completely rewritten since the context file was last updated.

**Current behavior:** No semantic drift detection — only structural checks.

**Desired behavior:** Flag when a referenced file has changed significantly since the context file was last committed (via `git diff`).

**Where to fix:** `src/commands/diff.js` already has partial git-diff logic — extend it to detect semantic staleness in `check` as well.

---

### 4. `redundant-readme` borderline case (ruff) — open

**Problem:** ruff's "Development Guidelines" section was flagged at ~45% trigram overlap with the README "Rules" section. Manual review needed to confirm whether this is a true positive or the trigram threshold is too low for technical content.

**Current behavior:** Flagged as `warn`.

**Desired behavior:** Investigate whether the 40% threshold (`TRIGRAM_OVERLAP_THRESHOLD`) should be raised for repos with highly technical/domain-specific vocabulary, where common technical terms inflate overlap scores.

**Where to fix:** `src/constants.js` → `THRESHOLDS.TRIGRAM_OVERLAP_THRESHOLD`; `src/rules/redundant-readme.js`

---

### 5. Token cost assumptions (`token-budget`) — open

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
| next.js, codex, langchain | `stale-file-ref` monorepo-relative paths | FP→warn | Suffix match detection — downgraded to `warn` with prefix suggestion |

## Precision

| | Count |
|---|---|
| Total diagnostics emitted (unique files) | ~33 |
| False positives before fixes | ~12 |
| Precision before fixes | ~68% |
| False positives after fixes | ~2 borderline |
| Precision after fixes | ~91% |

Target was >80% before publishing. ✓
