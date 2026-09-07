#!/usr/bin/env bash
# readme-craft dependency checker.
# Requires Node 18+ and npm. Installs own node_modules for logo/comparison generation.
# No skill dependencies — sources the shared lib only for template consistency.
set -euo pipefail

echo "readme-craft: checking dependencies..."
echo ""

errors=0

# --- CLI tools ---
if ! command -v node &>/dev/null; then
  echo "  node: NOT FOUND — Node.js 18+ is required for logo generation"
  echo "  Install: https://nodejs.org/"
  errors=$((errors + 1))
else
  NODE_MAJOR=$(node -e "console.log(process.versions.node.split('.')[0])")
  if [ "$NODE_MAJOR" -lt 18 ]; then
    echo "  node: v$(node --version) — requires 18+, please upgrade"
    errors=$((errors + 1))
  else
    echo "  node: $(command -v node) (v$(node --version | tr -d 'v'))"
  fi
fi

if ! command -v npm &>/dev/null; then
  echo "  npm: NOT FOUND"
  errors=$((errors + 1))
else
  echo "  npm: $(command -v npm)"
fi

echo ""

# --- npm packages (readme-craft's own node_modules) ---
SKILL_DIR="$(cd "$(dirname "$0")/.." && pwd)"
if [ "$errors" -eq 0 ] && [ ! -d "$SKILL_DIR/node_modules" ]; then
  echo "  Installing npm dependencies..."
  if ! (cd "$SKILL_DIR" && npm install --silent); then
    echo "  ERROR: npm install failed"
    errors=$((errors + 1))
  fi
fi
[ -d "$SKILL_DIR/node_modules" ] && echo "  node_modules: installed"

echo ""

# --- Skill dependencies via shared lib ---
# readme-craft has no skill dependencies. Sourced for template consistency;
# if a future dependency is added, call install_skill here.
source "$(dirname "$0")/install-skill-lib.sh"

echo ""

# --- Result ---
if [ "$errors" -gt 0 ]; then
  echo "BLOCKED: $errors dependency issue(s). Fix above errors and re-run."
  exit 1
fi

echo "readme-craft: all dependencies ready."
exit 0
