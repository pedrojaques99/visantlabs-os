/**
 * Dump the OpenAPI spec to sdks/typescript/openapi.json
 * without needing the dev server running.
 * Usage: npx tsx scripts/dump-openapi-spec.ts
 */

import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { generateMCPOpenAPISpec } from '../server/lib/mcp-to-openapi.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const spec = generateMCPOpenAPISpec('0.1.0', 'https://api.visantlabs.com');
const out = join(root, 'sdks/typescript/openapi.json');
writeFileSync(out, JSON.stringify(spec, null, 2));
const pathCount = Object.keys(spec.paths as Record<string, unknown>).length;
console.log(`Wrote spec to ${out} (${pathCount} paths)`);
