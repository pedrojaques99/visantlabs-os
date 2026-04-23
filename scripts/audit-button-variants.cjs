#!/usr/bin/env node
/**
 * audit-button-variants.cjs
 * Reports Button ghost overrides that should use a design-system variant.
 * Run: node scripts/audit-button-variants.cjs
 * Output: console (pipe to file if needed)
 *
 * For each match, prints: file:line — className value — suggested variant
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// className value substring → suggested variant
const SUGGESTIONS = [
  // menuItem
  { match: 'w-full justify-start px-3 py-2', variant: 'menuItem', note: 'full-width mono dropdown item' },
  { match: 'w-full text-left px-3 py-2', variant: 'menuItem', note: 'full-width left-aligned dropdown item' },
  // toolbar
  { match: 'uppercase tracking-widest', variant: 'toolbar', note: 'uppercase compact toolbar button' },
  // action
  { match: 'p-1.5 text-neutral-500 hover:text-neutral-300', variant: 'action', note: 'inline icon action' },
  { match: 'p-1.5 hover:bg-neutral-700', variant: 'action', note: 'inline icon action' },
  { match: 'p-1.5 hover:bg-neutral-800', variant: 'action', note: 'inline icon action' },
  { match: 'p-1 hover:bg-neutral-800 rounded', variant: 'action', note: 'compact icon action' },
  // danger
  { match: 'hover:bg-red-500/10 hover:text-red-400', variant: 'danger', note: 'destructive icon action' },
  { match: '!bg-red-500/10', variant: 'danger', note: 'destructive icon action (forced)' },
  // surface
  { match: 'bg-neutral-800/50 hover:bg-neutral-700/50 border border-neutral-700/50 text-neutral-300', variant: 'surface', note: 'bordered muted button' },
  { match: 'bg-neutral-950/70 hover:bg-neutral-800/50 border border-neutral-800/50 text-neutral-300', variant: 'surface', note: 'bordered muted button (dark bg)' },
];

function getFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && !['node_modules', '.git', 'dist'].includes(entry.name)) {
      results.push(...getFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.tsx')) {
      results.push(full);
    }
  }
  return results;
}

const files = [
  ...getFiles(path.join(ROOT, 'src/pages')),
  ...getFiles(path.join(ROOT, 'src/components')),
];

const byVariant = {};
let total = 0;

for (const filePath of files) {
  const relPath = path.relative(ROOT, filePath);
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.includes('variant="ghost"') && !line.includes("className=")) continue;

    // Look at lines i-2..i+3 for a ghost button + className combo
    const window = lines.slice(Math.max(0, i - 1), i + 4).join(' ');
    if (!window.includes('variant="ghost"')) continue;

    for (const { match, variant, note } of SUGGESTIONS) {
      if (window.includes(match)) {
        if (!byVariant[variant]) byVariant[variant] = [];
        byVariant[variant].push({ file: relPath, line: i + 1, note, snippet: line.trim().slice(0, 80) });
        total++;
        break;
      }
    }
  }
}

// Print report
console.log(`\nButton ghost override audit — ${total} candidates\n${'═'.repeat(60)}`);
for (const [variant, hits] of Object.entries(byVariant)) {
  console.log(`\n  variant="${variant}"  (${hits.length} occurrences)`);
  console.log(`  ${'─'.repeat(56)}`);
  for (const { file, line, snippet } of hits) {
    console.log(`  ${file}:${line}`);
    console.log(`    ${snippet}`);
  }
}
console.log(`\n${'═'.repeat(60)}`);
console.log(`Replace className overrides with the variant above.`);
console.log(`button.tsx variants: surface | toolbar | action | danger | menuItem | info | warning\n`);
