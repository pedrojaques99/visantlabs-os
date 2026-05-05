/**
 * Audit: verifica sincronizacao entre PLATFORM_TOOLS (mcp-gen.ts) e platform-mcp.ts (runtime).
 *
 * Uso: npx tsx server/lib/tools/audit-sync.ts
 *
 * Extrai nomes de ferramentas do runtime via regex e compara com o registry de documentacao.
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../..');

// --- Extrair nomes do runtime (platform-mcp.ts) ---
const runtimeSource = readFileSync(resolve(ROOT, 'server/mcp/platform-mcp.ts'), 'utf-8');
// Suporta descricoes com escaped quotes (e.g. 'Update a mockup\'s ...')
const runtimeToolRegex = /server\.tool\(\s*'([^']+)',\s*'((?:[^'\\]|\\.)*)'/g;
const runtimeTools = new Map<string, string>();
let match: RegExpExecArray | null;
while ((match = runtimeToolRegex.exec(runtimeSource)) !== null) {
  runtimeTools.set(match[1], match[2].replace(/\\'/g, "'"));
}

// --- Extrair nomes do registry (mcp-gen.ts) ---
const genSource = readFileSync(resolve(ROOT, 'server/lib/mcp-gen.ts'), 'utf-8');
// Suporta description com aspas simples ou duplas
const genToolRegex = /\{\s*name:\s*'([^']+)',\s*description:\s*(?:'([^']*(?:''[^']*)*)'|"([^"]*(?:""[^"]*)*)")/g;
const genTools = new Map<string, string>();
while ((match = genToolRegex.exec(genSource)) !== null) {
  genTools.set(match[1], match[2] ?? match[3]);
}

// --- Comparar ---
const missingInGen: string[] = [];
const missingInRuntime: string[] = [];
const descriptionDrift: Array<{ name: string; runtime: string; gen: string }> = [];

for (const [name, desc] of runtimeTools) {
  if (!genTools.has(name)) {
    missingInGen.push(name);
  } else {
    const genDesc = genTools.get(name)!;
    if (genDesc !== desc) {
      descriptionDrift.push({ name, runtime: desc, gen: genDesc });
    }
  }
}

for (const name of genTools.keys()) {
  if (!runtimeTools.has(name)) {
    missingInRuntime.push(name);
  }
}

// --- Relatorio ---
console.log('=== MCP Tools Sync Audit ===\n');
console.log(`Runtime (platform-mcp.ts): ${runtimeTools.size} tools`);
console.log(`Registry (mcp-gen.ts):     ${genTools.size} tools\n`);

if (missingInGen.length === 0 && missingInRuntime.length === 0 && descriptionDrift.length === 0) {
  console.log('OK — All tools in sync.');
  process.exit(0);
}

if (missingInGen.length > 0) {
  console.log(`\n--- Missing in mcp-gen.ts (${missingInGen.length}): ---`);
  missingInGen.forEach((n) => console.log(`  - ${n}`));
}

if (missingInRuntime.length > 0) {
  console.log(`\n--- In mcp-gen.ts but NOT in runtime (${missingInRuntime.length}): ---`);
  missingInRuntime.forEach((n) => console.log(`  - ${n}`));
}

if (descriptionDrift.length > 0) {
  console.log(`\n--- Description drift (${descriptionDrift.length}): ---`);
  descriptionDrift.forEach(({ name, runtime, gen }) => {
    console.log(`  [${name}]`);
    console.log(`    runtime: ${runtime.slice(0, 80)}...`);
    console.log(`    gen:     ${gen.slice(0, 80)}...`);
  });
}

process.exit(missingInGen.length + missingInRuntime.length + descriptionDrift.length > 0 ? 1 : 0);
