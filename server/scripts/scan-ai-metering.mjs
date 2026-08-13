#!/usr/bin/env node
/**
 * scan-ai-metering — portão da LEI de contabilização de IA.
 *
 * LEI: toda chamada a provedor de IA que gasta dinheiro grava um usage_record.
 *
 * Este script varre server/ atrás de call sites de provedor e reporta quais
 * arquivos gastam sem contabilizar. Serve como ratchet: a allowlist só encolhe.
 *
 *   node server/scripts/scan-ai-metering.mjs           # relatório
 *   node server/scripts/scan-ai-metering.mjs --check    # exit 1 se piorar (CI)
 *   node server/scripts/scan-ai-metering.mjs --update   # regrava a baseline
 *
 * A baseline mora em server/scripts/ai-metering-baseline.json.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SERVER = join(ROOT, 'server');
const BASELINE = join(ROOT, 'server', 'scripts', 'ai-metering-baseline.json');

// Instanciação/chamada direta de provedor pago.
const PROVIDER_PATTERNS = [
  { re: /new GoogleGenAI\b/g, provider: 'gemini' },
  { re: /new GoogleGenerativeAI\b/g, provider: 'gemini' },
  { re: /\bnew OpenAI\s*\(/g, provider: 'openai' },
  { re: /bytepluses\.com/g, provider: 'seedream' },
  { re: /api\.ideogram\.ai/g, provider: 'ideogram' },
  { re: /api\.reve\.(com|art)/g, provider: 'reve' },
  { re: /generativelanguage\.googleapis\.com/g, provider: 'gemini-rest' },
];

// Prova de contabilização no mesmo arquivo.
const METER_PATTERNS = [
  /usage_records/,
  /trackUsage\s*\(/,
  /recordUsage\s*\(/,
  /meteredCall\s*\(/,
  /meterResult\s*\(/,
  /meteredGemini\s*\(/,
  /recordAiUsage\s*\(/,
];

// Arquivos que podem instanciar provedor por natureza (o próprio portão e este scanner).
const GATE_FILES = ['server/lib/ai/metered.ts', 'server/scripts/scan-ai-metering.mjs'];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name === '__tests__') continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(ts|mts|mjs|js)$/.test(name) && !/\.(test|spec)\./.test(name)) out.push(p);
  }
  return out;
}

const findings = [];
for (const file of walk(SERVER)) {
  const rel = relative(ROOT, file).replace(/\\/g, '/');
  if (GATE_FILES.includes(rel)) continue;
  const src = readFileSync(file, 'utf8');

  const providers = new Set();
  let calls = 0;
  for (const { re, provider } of PROVIDER_PATTERNS) {
    const m = src.match(re);
    if (m) {
      providers.add(provider);
      calls += m.length;
    }
  }
  if (!providers.size) continue;

  const metered = METER_PATTERNS.some((re) => re.test(src));
  findings.push({ file: rel, providers: [...providers].sort(), calls, metered });
}

findings.sort((a, b) => Number(a.metered) - Number(b.metered) || a.file.localeCompare(b.file));

const unmetered = findings.filter((f) => !f.metered).map((f) => f.file);
const args = process.argv.slice(2);

if (args.includes('--update')) {
  writeFileSync(BASELINE, JSON.stringify({ unmetered }, null, 2) + '\n');
  console.log(`baseline gravada: ${unmetered.length} arquivos sem contabilização`);
  process.exit(0);
}

console.log(`\nCall sites de provedor pago em server/: ${findings.length} arquivos\n`);
for (const f of findings) {
  const mark = f.metered ? 'OK  ' : 'GAP ';
  console.log(`${mark} ${f.file}  (${f.providers.join(', ')}, ${f.calls} call site(s))`);
}
console.log(
  `\n${findings.length - unmetered.length} contabilizam, ${unmetered.length} NAO contabilizam.\n`
);

if (args.includes('--check')) {
  if (!existsSync(BASELINE)) {
    console.error('sem baseline — rode com --update primeiro');
    process.exit(1);
  }
  const base = JSON.parse(readFileSync(BASELINE, 'utf8')).unmetered;
  const novos = unmetered.filter((f) => !base.includes(f));
  const curados = base.filter((f) => !unmetered.includes(f));

  if (curados.length) console.log(`curados desde a baseline: ${curados.join(', ')}`);
  if (novos.length) {
    console.error(`\nLEI VIOLADA — arquivo novo gasta sem contabilizar:`);
    for (const f of novos) console.error(`  ${f}`);
    console.error(`\nUse o portão (server/lib/ai/metered.ts) ou grave um usage_record.`);
    process.exit(1);
  }
  console.log('portão OK — nenhum gasto novo sem contabilização.');
}
