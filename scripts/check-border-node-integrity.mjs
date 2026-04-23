#!/usr/bin/env node
/**
 * check-border-node-integrity.mjs
 *
 * Verifies that the `border-node` @utility in index.css defines BOTH
 * border-style AND border-width (replacing `border` which sets both).
 * Also checks that files using `border-node` don't also have a plain `border`
 * class on the same element (redundant).
 *
 * Run: node scripts/check-border-node-integrity.mjs
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const CSS = join(ROOT, 'src/index.css');

let errors = 0;

// ── 1. Verify @utility border-node has both border-style and border-width ──
const css = readFileSync(CSS, 'utf8');
const utilityBlock = css.match(/@utility border-node\s*\{([^}]+)\}/);

if (!utilityBlock) {
  console.error('ERROR: @utility border-node not found in index.css');
  errors++;
} else {
  const body = utilityBlock[1];

  if (!body.includes('border-style')) {
    console.error('ERROR: @utility border-node is missing border-style: solid');
    console.error('  Without border-style, borders disappear (browser default is none).');
    errors++;
  }

  if (!body.includes('border-width')) {
    console.error('ERROR: @utility border-node is missing border-width');
    errors++;
  }

  // Sub-pixel (< 1px) borders render as 0px on 1x Windows/Linux displays — invisible.
  const subpixel = body.match(/border-width:\s*(var\([^)]+\))/);
  if (subpixel) {
    // Resolve the CSS variable value
    const varName = subpixel[1].match(/var\(([^)]+)\)/)?.[1];
    if (varName) {
      const varMatch = css.match(new RegExp(`${varName.replace('--', '--')}:\\s*([^;\\n]+)`));
      const value = varMatch?.[1]?.trim();
      if (value) {
        const px = parseFloat(value);
        if (!isNaN(px) && px < 1) {
          console.error(`ERROR: --node-border-width is ${value} — sub-pixel borders are invisible on 1x displays.`);
          console.error('  Fix: use 1px minimum. Visual thinness should come from border COLOR opacity, not sub-pixel width.');
          errors++;
        }
      }
    }
  }

  if (errors === 0) {
    console.log('✓ @utility border-node defines border-style and border-width correctly.');
  }
}

// ── 2. Check for `border border-node` redundancy (border sets 1px, border-node sets 0.5px — conflict) ──
const { readFileSync: rf, readdirSync, statSync } = await import('fs');

function walkTsx(dir) {
  const out = [];
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) out.push(...walkTsx(p));
    else if (f.endsWith('.tsx')) out.push(p);
  }
  return out;
}

const REACTFLOW = join(ROOT, 'src/components/reactflow');
const UI = join(ROOT, 'src/components/ui');

const files = [
  ...walkTsx(REACTFLOW),
  join(UI, 'textarea.tsx'),
  join(UI, 'select.tsx'),
  join(UI, 'input.tsx'),
];

let redundant = 0;
for (const f of files) {
  let src;
  try { src = readFileSync(f, 'utf8'); } catch { continue; }
  const lines = src.split('\n');
  lines.forEach((line, i) => {
    // flag: `border border-node` (1px AND 0.5px — the 1px wins, defeating the token)
    if (/\bborder border-node\b/.test(line)) {
      console.error(`REDUNDANCY: ${f.replace(ROOT, '')}:${i + 1}`);
      console.error(`  "border border-node" — the plain 'border' (1px) overrides border-node (0.5px). Remove 'border'.`);
      redundant++;
    }
    // flag: completely missing border-node but has border-<color> alone (might need border-node)
    // (info only, not an error)
  });
}

if (redundant) errors += redundant;

if (errors === 0) {
  console.log('✓ No border-node integrity issues found.');
  process.exit(0);
} else {
  console.log(`\n${errors} issue(s) found.`);
  process.exit(1);
}
