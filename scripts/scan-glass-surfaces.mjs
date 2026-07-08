#!/usr/bin/env node
/**
 * scan-glass-surfaces.mjs
 *
 * Audits app surfaces that should use the shared glass SSoT in
 * src/lib/ui/glass.ts or the GlassPanel/Button primitives.
 *
 * Usage:
 *   node scripts/scan-glass-surfaces.mjs
 *   node scripts/scan-glass-surfaces.mjs --summary
 *   node scripts/scan-glass-surfaces.mjs --json
 *   node scripts/scan-glass-surfaces.mjs --no-fail
 */

import { existsSync, readdirSync, readFileSync } from 'fs';
import { extname, join, relative } from 'path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const ARGS = new Set(process.argv.slice(2));
const SUMMARY = ARGS.has('--summary');
const JSON_OUT = ARGS.has('--json');
const NO_FAIL = ARGS.has('--no-fail');

const SCAN_ROOTS = ['src/pages', 'src/components'];
const SCAN_EXTENSIONS = new Set(['.tsx', '.jsx']);
const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next']);

const norm = (p) => p.replace(/[\\/]/g, '/');

const ALLOW_PATH_PREFIXES = [
  'src/components/brand/', // brand-token surfaces intentionally use CSS vars
  'src/components/branding/', // guideline editor has theme-specific surfaces
  'src/components/budget/', // PDF/editor surfaces differ from app chrome
  'src/components/3d',
  'src/components/canvas/',
  'src/components/reactflow/', // node chrome has separate node-token audit
  'src/pages/DesignSystemPage.tsx',
];

const SEMANTIC_ALLOW = [
  /destructive\//,
  /brand-cyan\//,
  /success\//,
  /warning\//,
  /blue-\d+\//,
  /red-\d+\//,
  /green-\d+\//,
  /amber-\d+\//,
  /purple-\d+\//,
  /data-\[state=active\]/,
  /border-b\b|border-t\b|border-l\b|border-r\b/,
  /TableRow|TableHead|TableCell/,
];

const RULES = [
  {
    id: 'manual-panel-surface',
    severity: 'error',
    suggest: 'Use cn("rounded-* ...", glassSurface.panel) or <GlassPanel>.',
    re: /(?:rounded-(?:2xl|3xl)[^"'`]*)(?:bg-white\/\[0\.03\]|bg-neutral-9(?:00|50)\/(?:20|30|40|45|50|60|70))[^"'`]*(?:border-neutral-800|border-white\/\[(?:0\.06|0\.08|0\.09|0\.10)\])|(?:border-neutral-800|border-white\/\[(?:0\.06|0\.08|0\.09|0\.10)\])[^"'`]*(?:bg-white\/\[0\.03\]|bg-neutral-9(?:00|50)\/(?:20|30|40|45|50|60|70))/,
  },
  {
    id: 'manual-tile-surface',
    severity: 'warn',
    suggest: 'Use cn("rounded-xl ...", glassSurface.tile).',
    re: /rounded-xl[^"'`]*(?:bg-white\/\[(?:0\.03|0\.04)\]|bg-neutral-900\/60)[^"'`]*(?:border-neutral-800|border-white\/\[(?:0\.06|0\.08)\])/,
  },
  {
    id: 'manual-control-surface',
    severity: 'warn',
    suggest: 'Use glassSurface.control or Button variant="surface".',
    re: /(?:bg-white\/\[0\.03\]|bg-neutral-800\/50|bg-neutral-900\/60)[^"'`]*(?:border-neutral-700\/50|border-neutral-800)/,
  },
  {
    id: 'manual-glass-blur',
    severity: 'warn',
    suggest: 'Use glassSurface.panel/tile/control unless this is an overlay or layout chrome.',
    re: /backdrop-blur-(?:md|xl|2xl)[^"'`]*(?:border-neutral-800|bg-neutral-950\/)/,
  },
];

function walk(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!IGNORE_DIRS.has(entry.name)) out.push(...walk(abs));
    } else if (SCAN_EXTENSIONS.has(extname(entry.name))) {
      out.push(abs);
    }
  }
  return out;
}

function isPathAllowed(rel) {
  const n = norm(rel);
  return ALLOW_PATH_PREFIXES.some((prefix) => n.startsWith(prefix));
}

function isLineAllowed(line) {
  return SEMANTIC_ALLOW.some((re) => re.test(line));
}

const findings = [];

for (const root of SCAN_ROOTS) {
  for (const abs of walk(join(ROOT, root))) {
    const rel = norm(relative(ROOT, abs));
    if (isPathAllowed(rel)) continue;

    const src = readFileSync(abs, 'utf8');
    const lines = src.split(/\r?\n/);

    lines.forEach((line, idx) => {
      if (!line.includes('className') && !line.includes('className={cn')) return;
      if (line.includes('glassSurface') || line.includes('GlassPanel')) return;
      if (isLineAllowed(line)) return;

      for (const rule of RULES) {
        if (!rule.re.test(line)) continue;
        findings.push({
          rule: rule.id,
          severity: rule.severity,
          file: rel,
          line: idx + 1,
          suggest: rule.suggest,
          code: line.trim().slice(0, 220),
        });
        break;
      }
    });
  }
}

if (JSON_OUT) {
  console.log(JSON.stringify({ count: findings.length, findings }, null, 2));
} else if (SUMMARY) {
  const byRule = findings.reduce((acc, f) => {
    acc[f.rule] = (acc[f.rule] || 0) + 1;
    return acc;
  }, {});
  console.log(`Glass surface findings: ${findings.length}`);
  for (const [rule, count] of Object.entries(byRule).sort()) {
    console.log(`  ${rule}: ${count}`);
  }
} else if (findings.length === 0) {
  console.log('Glass surface audit passed.');
} else {
  console.log(`Glass surface findings: ${findings.length}\n`);
  for (const f of findings) {
    console.log(`${f.severity.toUpperCase()} ${f.rule} ${f.file}:${f.line}`);
    console.log(`  ${f.code}`);
    console.log(`  ${f.suggest}\n`);
  }
}

if (findings.some((f) => f.severity === 'error') && !NO_FAIL) {
  process.exit(1);
}