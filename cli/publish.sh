#!/usr/bin/env bash
# publish.sh — build, bump se necessário, e publica no npm
set -e

cd "$(dirname "$0")"

echo ""
echo "  📦 Visant CLI — publish"
echo ""

# 1. Build
echo "→ Building…"
npm run build

# 2. Tentar publicar — se falhar por versão duplicada, bump patch e tenta de novo
echo "→ Publicando…"
if ! npm publish --access public 2>&1; then
  echo ""
  echo "  Versão já existe no registry. Fazendo bump de patch…"
  npm version patch --no-git-tag-version
  NEW_VERSION=$(node -p "require('./package.json').version")
  echo "  Nova versão: $NEW_VERSION"
  echo ""
  npm publish --access public
fi

VERSION=$(node -p "require('./package.json').version")
echo ""
echo "  ✅ Publicado: visant@$VERSION"
echo "  npm install -g visant"
echo ""
