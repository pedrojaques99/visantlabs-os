#!/usr/bin/env node
/**
 * thin-node-borders.mjs
 *
 * Reduces inner node borders to 0.5px across all shared UI primitives
 * AND all reactflow node files (inline border classes).
 *
 * Run:      node scripts/thin-node-borders.mjs
 * Dry-run:  node scripts/thin-node-borders.mjs --dry
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

function walkTsx(dir) {
  const entries = [];
  for (const f of readdirSync(dir)) {
    const abs = join(dir, f);
    if (statSync(abs).isDirectory()) entries.push(...walkTsx(abs));
    else if (f.endsWith('.tsx')) entries.push(abs);
  }
  return entries;
}

const DRY = process.argv.includes('--dry');
const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');

// `border-node` is a @utility defined in index.css → border-width: var(--node-border-width)
// This is the Tailwind v4-native approach: no arbitrary values, no !important.
const TARGET_CLASS = 'border-node';

// Shared UI primitives
const SHARED = [
  'src/components/ui/textarea.tsx',
  'src/components/ui/select.tsx',
  'src/components/ui/input.tsx',
  'src/components/reactflow/shared/node-button.tsx',
];

// All *Node.tsx files + shared reactflow components
const NODES_DIR = join(ROOT, 'src/components/reactflow');
const SHARED_DIR = join(NODES_DIR, 'shared');

// Walk entire reactflow tree recursively
const NODE_FILES = walkTsx(NODES_DIR);

const ALL_FILES = [
  ...SHARED.map(r => join(ROOT, r)),
  ...NODE_FILES,
].filter((v, i, a) => a.indexOf(v) === i); // dedupe

// ─── Replacement rules ────────────────────────────────────────────────────────
const RULES = [
  // normalise any previous arbitrary-value run → border-node
  [/\bborder-\[(?:0\.[0-9]+px)\] (border-[^\s"']+)/g, `${TARGET_CLASS} $1`],
  // plain `border border-<color>` → border-node border-<color>
  [/\bborder (border-[^\s"']+)/g, `${TARGET_CLASS} $1`],
  // deduplicate border-node border-node
  [new RegExp(`\\b${TARGET_CLASS} ${TARGET_CLASS}\\b`, 'g'), TARGET_CLASS],
];

// ─── Run ──────────────────────────────────────────────────────────────────────
let changed = 0;

for (const abs of ALL_FILES) {
  let src;
  try { src = readFileSync(abs, 'utf8'); } catch { continue; }

  let next = src;
  for (const [pattern, replacement] of RULES) {
    next = next.replace(pattern, replacement);
  }

  if (next === src) continue;

  const rel = abs.replace(ROOT + '/', '').replace(ROOT + '\\', '');
  if (DRY) {
    console.log(`  [dry] ${rel}`);
  } else {
    writeFileSync(abs, next, 'utf8');
    console.log(`  patched: ${rel}`);
    changed++;
  }
}

console.log(DRY
  ? '\nDry run complete.'
  : `\nDone — ${changed} file(s) patched to ${TARGET_CLASS}.`);
