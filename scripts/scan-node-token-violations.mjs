#!/usr/bin/env node
/**
 * scan-node-token-violations.mjs
 *
 * Scans canvas node files for design token violations.
 * Run: node scripts/scan-node-token-violations.mjs
 *
 * Exit 0 = no violations. Exit 1 = violations found.
 */

import { readdirSync, readFileSync } from 'fs';
import { join, relative } from 'path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const NODES_DIR = join(ROOT, 'src/components/reactflow');
const UI_DIR    = join(ROOT, 'src/components/ui');

// ─── Rule definitions ────────────────────────────────────────────────────────
const RULES = [
  {
    id: 'custom-node-header',
    description: 'Custom header div instead of <NodeHeader>',
    fix: "Replace the custom header div with <NodeHeader icon={...} title={...} />",
    pattern: /border-b\s+border-neutral-700.*bg-gradient-to-r|bg-gradient-to-r.*border-b\s+border-neutral-700/,
    scope: 'nodes',
  },
  {
    id: 'weak-border-token',
    description: 'Border with very low-opacity neutral-800 (border-neutral-800/10 or /5)',
    fix: "Use border-neutral-800 (full opacity) for component borders inside nodes",
    pattern: /border-neutral-800\/(5|10)\b/,
    scope: 'nodes-and-ui',
  },
  {
    id: 'plain-border-1px',
    description: "Standalone 'border' class (1px) inside node — should be 'border-node'",
    fix: "Replace 'border ' with 'border-node ' — border-node uses --node-border-width (0.5px)",
    // Matches `border ` followed by anything that isn't `-node` or a border-color class
    // i.e. catches `border transition-all`, `border rounded`, etc. (standalone border without color on same line)
    pattern: /\bborder\s+(?!node\b|border-)[a-zA-Z]/,
    scope: 'nodes-and-ui',
  },
  {
    id: 'high-contrast-foreground-border',
    description: "border-foreground/* inside node — creates bright white border, use border-neutral-800",
    fix: "Replace border-foreground/* with border-neutral-800 for dark-theme nodes",
    pattern: /border-foreground\//,
    scope: 'nodes',
  },
  {
    id: 'ghost-border',
    description: 'border-white/5 — nearly invisible border (node-variant inputs/selects)',
    fix: "Use border-neutral-800 for node-variant interactive elements",
    pattern: /border-white\/5(?!\d)/,
    scope: 'nodes-and-ui',
  },
  {
    id: 'rounded-xl-in-node-interactive',
    description: 'rounded-xl on a node trigger/input element (should be rounded-md)',
    fix: "Use rounded-md for inputs, selects, and accordion triggers inside nodes",
    pattern: /(?:node-interactive|variant.*node|node.*variant).*rounded-xl|rounded-xl.*(?:node-interactive|variant.*node|node.*variant)/,
    scope: 'nodes-and-ui',
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getNodeFiles(dir) {
  return readdirSync(dir)
    .filter(f => f.endsWith('Node.tsx'))
    .map(f => join(dir, f));
}

function getUiFiles(dir) {
  return ['textarea.tsx', 'select.tsx', 'input.tsx']
    .map(f => join(dir, f));
}

function scanFile(filePath, rules) {
  let src;
  try { src = readFileSync(filePath, 'utf8'); } catch { return []; }
  const lines = src.split('\n');
  const violations = [];

  for (const rule of rules) {
    lines.forEach((line, i) => {
      if (rule.pattern.test(line)) {
        violations.push({
          file: relative(ROOT, filePath),
          line: i + 1,
          rule: rule.id,
          description: rule.description,
          fix: rule.fix,
          code: line.trim().slice(0, 120),
        });
      }
    });
  }
  return violations;
}

// ─── Run ─────────────────────────────────────────────────────────────────────
const nodeRules = RULES.filter(r => r.scope === 'nodes' || r.scope === 'nodes-and-ui');
const uiRules   = RULES.filter(r => r.scope === 'nodes-and-ui');

const allViolations = [
  ...getNodeFiles(NODES_DIR).flatMap(f => scanFile(f, nodeRules)),
  ...getUiFiles(UI_DIR).flatMap(f => scanFile(f, uiRules)),
];

if (allViolations.length === 0) {
  console.log('✓ No design token violations found.');
  process.exit(0);
}

// Group by rule for a cleaner report
const byRule = {};
for (const v of allViolations) {
  (byRule[v.rule] ??= []).push(v);
}

console.log(`\n╔══ Design Token Violations: ${allViolations.length} found ══╗\n`);

for (const [ruleId, items] of Object.entries(byRule)) {
  const first = items[0];
  console.log(`▸ [${ruleId}] ${first.description}`);
  console.log(`  Fix: ${first.fix}`);
  for (const v of items) {
    console.log(`  ${v.file}:${v.line}`);
    console.log(`    ${v.code}`);
  }
  console.log('');
}

process.exit(1);
