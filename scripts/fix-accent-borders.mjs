#!/usr/bin/env node
/**
 * fix-accent-borders.mjs
 *
 * Detects and fixes accent (brand-cyan) borders inside canvas node components.
 * Rules:
 *   - focus:border-brand-cyan/*   → focus:border-neutral-600
 *   - hover:border-brand-cyan/*   → hover:border-neutral-700
 *   - static border-brand-cyan/*  → border-neutral-800
 *     (EXCEPT on NodeContainer outer border — that's intentional for selected state)
 *
 * Run:      node scripts/fix-accent-borders.mjs
 * Dry-run:  node scripts/fix-accent-borders.mjs --dry
 * Scan:     node scripts/fix-accent-borders.mjs --scan
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const DRY  = process.argv.includes('--dry');
const SCAN = process.argv.includes('--scan');
const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');

function walkTsx(dir) {
  const out = [];
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) out.push(...walkTsx(p));
    else if (f.endsWith('.tsx') || f.endsWith('.ts')) out.push(p);
  }
  return out;
}

const FILES = [
  ...walkTsx(join(ROOT, 'src/components/reactflow')),
  ...walkTsx(join(ROOT, 'src/components/ui')),
];

// Lines/patterns that are SAFE to keep accent borders (outer container states, drawing mode)
const ALLOW_PATTERNS = [
  /NodeContainer.*border-brand-cyan/,           // outer container selected state
  /selected.*border-brand-cyan/,                // selected state
  /border-brand-cyan.*shadow-\[0_0/,            // glow effect on selected
  /DrawingText/,                                // drawing mode intentionally uses cyan
  /selected \? ['"].*border-brand-cyan/,        // ternary selected state
];

const REPLACEMENTS = [
  // focus/focus-visible border states
  [/focus-visible:border-brand-cyan(?:\/\d+)?/g,   'focus-visible:border-neutral-600'],
  [/focus:border-brand-cyan(?:\/\d+)?/g,            'focus:border-neutral-600'],
  [/focus:border-\[brand-cyan\](?:\/\d+)?/g,        'focus:border-neutral-600'],
  // hover border states
  [/hover:border-brand-cyan(?:\/\d+)?/g,            'hover:border-neutral-700'],
  [/hover:border-\[brand-cyan\](?:\/\d+)?/g,        'hover:border-neutral-700'],
  // focus ring glow — this is what creates the visible cyan halo on focus
  [/focus:ring-brand-cyan(?:\/\d+)?/g,              ''],
  [/focus:ring-\[brand-cyan\](?:\/\d+)?/g,          ''],
  [/focus-visible:ring-brand-cyan(?:\/\d+)?/g,      ''],
  // ring-N prefix when it's part of a focus ring pair (focus:ring-1 focus:ring-brand-cyan)
  // clean up orphaned `focus:ring-1` or `focus:ring-2` left after removing the color
  [/focus:ring-\d+\s+(?=focus:|$|")/g,              ''],
  [/focus-visible:ring-\d+\s+(?=focus:|$|")/g,      ''],
  // static border-brand-cyan with any opacity or bare
  [/(?<![?:'"\w-])border-brand-cyan\/\d+\b/g,       'border-neutral-800'],
  [/(?<![?:'"\w-])border-brand-cyan\b(?!\/)/g,      'border-neutral-800'],
  // static border-[brand-cyan] with any opacity or bare
  [/(?<![?:'"\w])border-\[brand-cyan\]\/\d+\b/g,    'border-neutral-800'],
  [/(?<![?:'"\w])border-\[brand-cyan\]\b(?!\/)/g,   'border-neutral-800'],
];

let violations = 0;
let changed = 0;

for (const abs of FILES) {
  let src;
  try { src = readFileSync(abs, 'utf8'); } catch { continue; }

  const lines = src.split('\n');
  const violatingLines = [];

  lines.forEach((line, i) => {
    if (/border-brand-cyan|border-\[brand-cyan\]/.test(line)) {
      const isAllowed = ALLOW_PATTERNS.some(p => p.test(line));
      if (!isAllowed) {
        violatingLines.push({ n: i + 1, code: line.trim().slice(0, 100) });
        violations++;
      }
    }
  });

  if (SCAN && violatingLines.length) {
    const rel = abs.replace(ROOT, '').replace(/^[/\\]/, '');
    console.log(`\n  ${rel}`);
    violatingLines.forEach(v => console.log(`    :${v.n}  ${v.code}`));
    continue;
  }

  if (!SCAN) {
    let next = src;
    for (const [pattern, replacement] of REPLACEMENTS) {
      // Skip lines that match allow patterns
      const newLines = next.split('\n').map(line => {
        const isAllowed = ALLOW_PATTERNS.some(p => p.test(line));
        if (isAllowed) return line;
        return line.replace(pattern, replacement);
      });
      next = newLines.join('\n');
    }

    if (next !== src) {
      if (DRY) {
        const rel = abs.replace(ROOT, '').replace(/^[/\\]/, '');
        console.log(`  [dry] ${rel}`);
      } else {
        writeFileSync(abs, next, 'utf8');
        const rel = abs.replace(ROOT, '').replace(/^[/\\]/, '');
        console.log(`  fixed: ${rel}`);
        changed++;
      }
    }
  }
}

if (SCAN) {
  if (violations === 0) console.log('✓ No accent border violations found.');
  else console.log(`\n${violations} accent border violation(s) found.`);
  process.exit(violations > 0 ? 1 : 0);
} else {
  console.log(DRY
    ? '\nDry run complete.'
    : `\nDone — ${changed} file(s) fixed.`);
}
