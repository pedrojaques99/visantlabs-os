#!/usr/bin/env bash
# Run once after cloning: configures git to use project hooks
set -e

if ! command -v git &>/dev/null; then
  echo "Git not found — skipping hooks setup (CI/Docker environment)."
  exit 0
fi

REPO_ROOT="$(git rev-parse --show-toplevel)"
HOOKS_DIR="$REPO_ROOT/.githooks"

git config core.hooksPath "$HOOKS_DIR"
chmod +x "$HOOKS_DIR"/*

echo "Git hooks configured. Pre-commit secret scanner active."
