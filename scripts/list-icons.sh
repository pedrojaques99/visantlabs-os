#!/usr/bin/env bash
# List every lucide-react icon used in the plugin UI.
# Also warns on banned icons (sparkles / magic / stars).
# Usage:
#   bash scripts/list-icons.sh          # grouped by file + flat list + ban check
#   bash scripts/list-icons.sh --flat   # flat deduplicated list only
#   bash scripts/list-icons.sh --check  # exit 1 if banned icons found (use in CI)

ROOT="plugin/src/ui"
BANNED="Sparkles|Wand2|Wand|Star|StarIcon|StarFilled|Stars|MagicWand"

flat() {
  grep -rh "from 'lucide-react'" "$ROOT" --include="*.tsx" \
    | grep -oP '(?<=\{ )[\w, ]+(?= \})' \
    | tr ',' '\n' | tr -d ' ' \
    | grep -v '^$' | sort -u
}

check_banned() {
  local found
  found=$(flat | grep -E "^($BANNED)$" || true)
  if [[ -n "$found" ]]; then
    echo "🚫 BANNED ICONS FOUND:" >&2
    echo "$found" >&2
    return 1
  fi
  return 0
}

case "${1:-}" in
  --flat)
    flat
    ;;
  --check)
    check_banned
    ;;
  *)
    echo "=== Icon usage by file ==="
    grep -rl "from 'lucide-react'" "$ROOT" --include="*.tsx" | sort | while read -r file; do
      icons=$(grep "from 'lucide-react'" "$file" \
        | grep -oP '(?<=\{ )[\w, ]+(?= \})' \
        | tr ',' '\n' | tr -d ' ' | grep -v '^$' | sort | tr '\n' ' ')
      [[ -z "$icons" ]] && continue
      echo ""
      echo "  ${file#$ROOT/}"
      echo "    $icons"
    done
    echo ""
    echo "=== All icons (flat) ==="
    flat
    echo ""
    echo "=== Ban check ==="
    if check_banned; then
      echo "OK — no banned icons"
    fi
    ;;
esac
