#!/usr/bin/env node
/**
 * migrate-button-variants.cjs
 * Replaces repeated Button ghost+className patterns with new design-system variants.
 * Run: node scripts/migrate-button-variants.cjs [--dry-run]
 *
 * Uses regex to handle whitespace variance in JSX.
 * Each rule: [regex, replacement, description]
 * Rules are ordered most-specific → least-specific.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DRY_RUN = process.argv.includes('--dry-run');

// Escape string for use inside regex
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Build a regex that matches className="<value>" with any surrounding whitespace
// Handles both single-line and multiline JSX attribute placement
function classAttr(value) {
  return new RegExp(`\\s*className="${esc(value)}"`, 'g');
}
function classAttrCn(innerPattern) {
  // matches className={cn( ... )} — skip these, they need manual review
  return null;
}

const RULES = [
  // ── menuItem: full-width mono dropdown items ───────────────────────────────
  {
    // ASCIIFooter pattern (exact)
    pattern: /variant="ghost"(\s+\w[^>]*?)className="w-full justify-start px-3 py-2 h-7 text-\[10px\] font-mono transition-colors text-neutral-400 hover:text-white hover:bg-neutral-900 border-none shadow-none"/gs,
    replacement: (_, between) => `variant="menuItem"${between.replace(/\s*className="[^"]*"/, '')}`,
    desc: 'menuItem — full-width mono dropdown (ASCIIFooter pattern)',
  },
  {
    // CanvasHeader dropdown items
    pattern: /variant="ghost"(\s+\w[^>]*?)className="w-full text-left px-3 py-2 text-xs text-neutral-300 hover:bg-neutral-800\/80 transition-colors flex items-center gap-2 font-mono"/gs,
    replacement: (_, between) => `variant="menuItem"${between.replace(/\s*className="[^"]*"/, '')}`,
    desc: 'menuItem — full-width left-aligned dropdown (CanvasHeader pattern)',
  },

  // ── toolbar: uppercase tracking, brand-cyan accent ─────────────────────────
  {
    pattern: /variant="ghost"(\s+\w[^>]*?)className="h-9 px-4 gap-2 text-\[10px\] font-bold uppercase tracking-widest text-neutral-400 hover:text-brand-cyan hover:bg-brand-cyan\/5"/gs,
    replacement: (_, between) => `variant="toolbar"${between.replace(/\s*className="[^"]*"/, '')}`,
    desc: 'toolbar — uppercase compact (BudgetMachine/Canvas pattern)',
  },
  {
    // CanvasProjectsPage variant (h-10 instead of h-9)
    pattern: /variant="ghost"(\s+\w[^>]*?)className="h-10 px-3 hover:bg-neutral-900\/40 text-neutral-400 hover:text-brand-cyan transition-all rounded-md flex items-center gap-2 text-\[10px\] font-bold uppercase tracking-widest"/gs,
    replacement: (_, between) => `variant="toolbar"${between.replace(/\s*className="[^"]*"/, '')}`,
    desc: 'toolbar — uppercase compact alt (CanvasProjects pattern)',
  },

  // ── action: inline icon buttons (p-1.5) ───────────────────────────────────
  {
    pattern: /variant="ghost"(\s+\w[^>]*?)className="p-1\.5 text-neutral-500 hover:text-neutral-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors rounded hover:bg-neutral-800\/30"/gs,
    replacement: (_, between) => `variant="action"${between.replace(/\s*className="[^"]*"/, '')}`,
    desc: 'action — disabled-aware icon button (Outputs/Mockups pattern)',
  },
  {
    pattern: /variant="ghost"(\s+\w[^>]*?)className="p-1\.5 hover:bg-neutral-700\/50 rounded transition-colors text-neutral-400 hover:text-neutral-200"/gs,
    replacement: (_, between) => `variant="action"${between.replace(/\s*className="[^"]*"/, '')}`,
    desc: 'action — simple icon button (ApiKeys pattern)',
  },
  {
    pattern: /variant="ghost"(\s+\w[^>]*?)className="p-1\.5 hover:bg-neutral-800\/50 rounded text-neutral-400 hover:text-white transition-colors"/gs,
    replacement: (_, between) => `variant="action"${between.replace(/\s*className="[^"]*"/, '')}`,
    desc: 'action — icon button (ImageFullscreen pattern)',
  },
  {
    // BrandCore compact (p-1 not p-1.5)
    pattern: /variant="ghost"(\s+\w[^>]*?)className="p-1 hover:bg-neutral-800 rounded"/gs,
    replacement: (_, between) => `variant="action"${between.replace(/\s*className="[^"]*"/, '')}`,
    desc: 'action — minimal icon button (BrandCore pattern)',
  },

  // ── surface: bordered muted button ────────────────────────────────────────
  {
    pattern: /variant="ghost"(\s+\w[^>]*?)className="inline-block px-4 py-2 bg-neutral-800\/50 hover:bg-neutral-700\/50 border border-neutral-700\/50 text-neutral-300 font-medium rounded-md text-sm font-mono transition-colors"/gs,
    replacement: (_, between) => `variant="surface"${between.replace(/\s*className="[^"]*"/, '')}`,
    desc: 'surface — auth-gate sign in button',
  },
  {
    pattern: /variant="ghost"(\s+\w[^>]*?)className="flex items-center gap-2 px-4 py-2 bg-neutral-950\/70 hover:bg-neutral-800\/50 border border-neutral-800\/50 text-neutral-300 font-medium rounded-md text-sm font-mono transition-colors"/gs,
    replacement: (_, between) => `variant="surface"${between.replace(/\s*className="[^"]*"/, '')}`,
    desc: 'surface — toolbar create button',
  },

  // ── admin text link ────────────────────────────────────────────────────────
  {
    pattern: /variant="ghost"(\s+\w[^>]*?)className="text-neutral-400 hover:text-neutral-200 transition-colors"/gs,
    replacement: (_, between) => `variant="ghost"${between}`,
    desc: 'SKIP — already minimal ghost (no className needed)',
  },
];

// ---------------------------------------------------------------------------
// File discovery
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------
let totalFiles = 0;
let totalFixes = 0;

for (const filePath of files) {
  const relPath = path.relative(ROOT, filePath);
  let src = fs.readFileSync(filePath, 'utf8');
  const original = src;
  const applied = [];

  for (const rule of RULES) {
    const matches = src.match(rule.pattern);
    if (matches) {
      src = src.replace(rule.pattern, rule.replacement);
      applied.push(`  ✓ ${rule.desc} (${matches.length}x)`);
      totalFixes += matches.length;
    }
  }

  if (applied.length > 0) {
    totalFiles++;
    console.log(`\n${relPath}`);
    applied.forEach(l => console.log(l));
    if (!DRY_RUN) fs.writeFileSync(filePath, src, 'utf8');
  }
}

const mode = DRY_RUN ? '[DRY RUN] ' : '';
console.log(`\n${'─'.repeat(50)}`);
console.log(`${mode}${totalFixes} replacements across ${totalFiles} files.`);
if (DRY_RUN) console.log('Run without --dry-run to apply.');
