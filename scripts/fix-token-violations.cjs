#!/usr/bin/env node
/**
 * fix-token-violations.cjs
 * Auto-fixes design token violations across the entire src/ directory.
 * Safe: only applies deterministic 1:1 token replacements.
 * Run: node scripts/fix-token-violations.cjs [--dry-run]
 *
 * --dry-run  Print what would change without writing files.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DRY_RUN = process.argv.includes('--dry-run');

// --- Hex → token map (add new entries here as you discover them) ---
const HEX_TOKEN_MAP = {
  '#0F0F0F': 'neutral-950',
  '#0C0C0C': 'neutral-950',
  '#0a0a0a': 'neutral-950',
  '#111111': 'neutral-900',
  '#171717': 'neutral-900',
  '#1a1a1a': 'neutral-900',
  '#262626': 'neutral-800',
  '#404040': 'neutral-700',
  '#525252': 'neutral-600',
  '#737373': 'neutral-500',
  '#a3a3a3': 'neutral-400',
  '#d4d4d4': 'neutral-300',
  '#e5e5e5': 'neutral-200',
  '#f5f5f5': 'neutral-100',
  '#fafafa': 'neutral-50',
};

function buildHexReplacements() {
  const replacements = [];
  for (const [hex, token] of Object.entries(HEX_TOKEN_MAP)) {
    const hexUpper = hex.toUpperCase();
    const hexLower = hex.toLowerCase();
    // Match bg-[#HEX], text-[#HEX], border-[#HEX], from-[#HEX], to-[#HEX], via-[#HEX]
    for (const prefix of ['bg', 'text', 'border', 'from', 'to', 'via']) {
      const patternLower = new RegExp(`${prefix}-\\[${hexLower}\\]`, 'g');
      const patternUpper = new RegExp(`${prefix}-\\[${hexUpper}\\]`, 'g');
      replacements.push([patternLower, `${prefix}-${token}`, `${prefix}-[${hex}] → ${prefix}-${token}`]);
      if (hexUpper !== hexLower) {
        replacements.push([patternUpper, `${prefix}-${token}`, `${prefix}-[${hexUpper}] → ${prefix}-${token}`]);
      }
    }
  }
  return replacements;
}

// --- All deterministic replacements ---
const REPLACEMENTS = [
  // P1 — Invalid Tailwind opacity values (scale stops at 100)
  [/\bopacity-300\b/g, 'opacity-100', 'opacity-300 → opacity-100'],
  [/\bopacity-200\b/g, 'opacity-100', 'opacity-200 → opacity-100'],
  [/\bopacity-150\b/g, 'opacity-100', 'opacity-150 → opacity-100'],
  [/group-hover:opacity-300\b/g, 'group-hover:opacity-100', 'group-hover:opacity-300 → opacity-100'],
  [/group-hover:opacity-200\b/g, 'group-hover:opacity-100', 'group-hover:opacity-200 → opacity-100'],
  [/hover:opacity-300\b/g, 'hover:opacity-100', 'hover:opacity-300 → opacity-100'],

  // P1 — Hex colors → design tokens (generated from map above)
  ...buildHexReplacements(),

  // P2 — Arbitrary font sizes → Tailwind scale
  [/\btext-\[10px\]\b/g, 'text-[10px]', null], // intentional micro-label size, skip
  [/\btext-\[12px\]\b/g, 'text-xs', 'text-[12px] → text-xs'],
  [/\btext-\[13px\]\b/g, 'text-xs', 'text-[13px] → text-xs'],
  [/\btext-\[14px\]\b/g, 'text-sm', 'text-[14px] → text-sm'],
  [/\btext-\[16px\]\b/g, 'text-base', 'text-[16px] → text-base'],

  // P3 — Arbitrary 1px values → Tailwind token
  [/\bw-\[1px\]\b/g, 'w-px', 'w-[1px] → w-px'],
  [/\bh-\[1px\]\b/g, 'h-px', 'h-[1px] → h-px'],
  [/\bborder-\[1px\]\b/g, 'border', 'border-[1px] → border'],

  // P3 — Arbitrary min-w/h pairs → size shorthand
  [/\bmin-w-\[16px\] min-h-\[16px\]\b/g, 'size-4', 'min-w/h-[16px] → size-4'],
  [/\bmin-w-\[14px\] min-h-\[14px\]\b/g, 'size-3.5', 'min-w/h-[14px] → size-3.5'],
  [/\bmin-w-\[12px\] min-h-\[12px\]\b/g, 'size-3', 'min-w/h-[12px] → size-3'],
].filter(([, , desc]) => desc !== null); // skip intentional skips

// --- File discovery ---
function getFiles(dir, ext = '.tsx') {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.git') {
      results.push(...getFiles(full, ext));
    } else if (entry.isFile() && entry.name.endsWith(ext)) {
      results.push(full);
    }
  }
  return results;
}

const files = [
  ...getFiles(path.join(ROOT, 'src/pages')),
  ...getFiles(path.join(ROOT, 'src/components')),
];

// --- Run ---
let totalFiles = 0;
let totalFixes = 0;
const report = [];

for (const filePath of files) {
  const relPath = path.relative(ROOT, filePath);
  let src = fs.readFileSync(filePath, 'utf8');
  const original = src;
  const fileFixes = [];

  for (const [pattern, replacement, desc] of REPLACEMENTS) {
    const matches = src.match(pattern);
    if (matches) {
      src = src.replace(pattern, replacement);
      fileFixes.push(`  ${desc} (${matches.length}x)`);
      totalFixes += matches.length;
    }
  }

  if (fileFixes.length > 0) {
    totalFiles++;
    report.push({ relPath, fixes: fileFixes });
    if (!DRY_RUN) {
      fs.writeFileSync(filePath, src, 'utf8');
    }
  }
}

// --- Report ---
const mode = DRY_RUN ? '[DRY RUN] ' : '';
console.log(`\n${mode}Token violation fixes\n${'─'.repeat(50)}`);
for (const { relPath, fixes } of report) {
  console.log(`\n${relPath}`);
  for (const fix of fixes) console.log(fix);
}
console.log(`\n${'─'.repeat(50)}`);
console.log(`${mode}${totalFixes} replacements across ${totalFiles} files.`);
if (DRY_RUN) console.log('Run without --dry-run to apply changes.');
