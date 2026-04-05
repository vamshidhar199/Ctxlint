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
