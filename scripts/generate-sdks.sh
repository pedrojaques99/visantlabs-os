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

# Python SDK placeholder — filled in Plan 02
echo "Done. SDKs generated."
