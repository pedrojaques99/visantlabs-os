#!/usr/bin/env bash
set -euo pipefail

SPEC_URL="${VISANT_API_URL:-http://localhost:3001}/api/openapi.json"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$SCRIPT_DIR/.."

echo "Fetching OpenAPI spec from $SPEC_URL..."
curl -sf "$SPEC_URL" -o "$ROOT/sdks/typescript/openapi.json"

echo "Generating TypeScript SDK..."
cd "$ROOT/sdks/typescript"
npx openapi-typescript-codegen --input openapi.json --output src --client fetch --exportSchemas true

# --- Python SDK ---
echo "Generating Python SDK..."
PYTHON_SDK_DIR="$ROOT/sdks/python"

# Copy spec for Python generator
cp "$ROOT/sdks/typescript/openapi.json" "$PYTHON_SDK_DIR/openapi.json"

# Generate or update Python client
if [ -d "$PYTHON_SDK_DIR/visant_sdk" ]; then
  cd "$PYTHON_SDK_DIR"
  openapi-python-client update --path openapi.json --config config.yml
else
  cd "$ROOT/sdks"
  openapi-python-client generate --path "$PYTHON_SDK_DIR/openapi.json" --config "$PYTHON_SDK_DIR/config.yml" --output-path "$PYTHON_SDK_DIR" --overwrite
fi

echo "Done. TypeScript + Python SDKs generated."
