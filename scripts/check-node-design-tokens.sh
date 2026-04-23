#!/usr/bin/env bash
# Checks that canvas node files follow design system token conventions.
# Run as part of CI: node files must not use custom header patterns or off-token borders.

set -e

NODES_DIR="src/components/reactflow"
ERRORS=0

echo "Checking node design token consistency..."

for file in "$NODES_DIR"/*Node.tsx; do
  # Skip shared directory
  [[ "$file" == *"/shared/"* ]] && continue

  # 1. Custom header pattern (should use NodeHeader component)
  if grep -qP 'border-b border-neutral-700.*bg-gradient-to-r' "$file"; then
    echo "ERROR: $file uses a custom header instead of <NodeHeader>. Use NodeHeader from './shared/node-header'."
    ERRORS=$((ERRORS + 1))
  fi

  # 2. Off-token border opacity on inner elements (border-neutral-800/10 is too transparent)
  if grep -qP 'border-neutral-800/10' "$file"; then
    echo "ERROR: $file uses border-neutral-800/10 — use border-neutral-800 (full opacity) for inner elements."
    ERRORS=$((ERRORS + 1))
  fi

  # 3. Rounded-xl on node-variant select/inputs (should be rounded-md)
  if grep -qP 'rounded-xl.*node-interactive|node-interactive.*rounded-xl' "$file"; then
    echo "ERROR: $file uses rounded-xl on a node interactive element — use rounded-md."
    ERRORS=$((ERRORS + 1))
  fi
done

# Also check the shared UI components
UI_DIR="src/components/ui"

# Textarea must use border-neutral-800 (not /10 or /5 weakened variants)
if grep -qP 'border border-neutral-800/\d+' "$UI_DIR/textarea.tsx"; then
  echo "ERROR: textarea.tsx uses a weakened border token — use border-neutral-800."
  ERRORS=$((ERRORS + 1))
fi

# Select node variant must use border-neutral-800 rounded-md
if grep -qP "border border-white/5|rounded-xl" "$UI_DIR/select.tsx"; then
  echo "ERROR: select.tsx node variant uses off-token border/radius — use border-neutral-800 rounded-md."
  ERRORS=$((ERRORS + 1))
fi

if [ $ERRORS -gt 0 ]; then
  echo ""
  echo "Found $ERRORS design token violation(s). Fix before building."
  exit 1
else
  echo "All node design token checks passed."
fi
