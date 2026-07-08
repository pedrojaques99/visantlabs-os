#!/usr/bin/env node
/**
 * check-ai-dash — guard against the "AI dash" in user-facing copy.
 *
 * The em dash (—), en dash (–), horizontal bar (―) and the literal double
 * hyphen (--) are the tell-tale signature of AI-generated text. This scans
 * locale JSON string values and flags them.
 *
 *   node scripts/check-ai-dash.mjs            # report only, exit 1 if found
 *   node scripts/check-ai-dash.mjs --fix      # auto-fix in place
 *   node scripts/check-ai-dash.mjs --fix a.json b.json   # custom targets
 *
 * Auto-fix rules (grammar-safe for PT-BR & EN):
 *   "word — word"  → "word, word"   (spaced dash acts as a comma)
 *   "A–Z" / "2x–4x" → "A-Z" / "2x-4x" (unspaced dash = simple hyphen)
 *   "foo--bar"     → "foo-bar"       (collapse the double hyphen)
 */
import fs from 'node:fs';

const args = process.argv.slice(2);
const FIX = args.includes('--fix');
const targets = args.filter((a) => !a.startsWith('--'));
const FILES = targets.length ? targets : ['src/locales/en-US.json', 'src/locales/pt-BR.json'];

// U+2014 em dash, U+2013 en dash, U+2015 horizontal bar
const DASH = '—–―';
const DETECT = new RegExp(`[${DASH}]|--`);

const fixString = (s) =>
  s
    .replace(new RegExp(`\\s*[${DASH}]\\s*`, 'g'), (m) =>
      // keep it a comma when the dash had spaces (clause break), else a hyphen
      /\s/.test(m) ? ', ' : '-'
    )
    .replace(/-{2,}/g, '-');

let total = 0;
let fixedFiles = 0;

const walk = (node, path, onHit) => {
  if (typeof node === 'string') {
    if (DETECT.test(node)) onHit(path, node);
    return node;
  }
  if (Array.isArray(node)) return node.map((v, i) => walk(v, `${path}[${i}]`, onHit));
  if (node && typeof node === 'object') {
    for (const k of Object.keys(node)) node[k] = walk(node[k], path ? `${path}.${k}` : k, onHit);
    return node;
  }
  return node;
};

for (const file of FILES) {
  if (!fs.existsSync(file)) {
    console.error(`skip (not found): ${file}`);
    continue;
  }
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const hits = [];

  walk(data, '', (path, value) => {
    hits.push({ path, value });
    total++;
  });

  if (hits.length === 0) continue;

  console.log(`\n${file} — ${hits.length} occurrence(s):`);
  for (const { path, value } of hits) {
    console.log(`  ${path}: ${JSON.stringify(value)}`);
    if (FIX) console.log(`    → ${JSON.stringify(fixString(value))}`);
  }

  if (FIX) {
    walk(data, '', () => {});
    // second pass: actually rewrite strings
    const rewrite = (node) => {
      if (typeof node === 'string') return fixString(node);
      if (Array.isArray(node)) return node.map(rewrite);
      if (node && typeof node === 'object') {
        for (const k of Object.keys(node)) node[k] = rewrite(node[k]);
        return node;
      }
      return node;
    };
    fs.writeFileSync(file, JSON.stringify(rewrite(data), null, 2) + '\n');
    fixedFiles++;
  }
}

if (total === 0) {
  console.log('OK — no AI dash found.');
  process.exit(0);
}

if (FIX) {
  console.log(`\nFixed ${total} occurrence(s) across ${fixedFiles} file(s).`);
  process.exit(0);
}

console.log(`\nFound ${total} AI dash occurrence(s). Run with --fix to clean, or replace by hand.`);
process.exit(1);
