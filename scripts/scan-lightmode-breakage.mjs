#!/usr/bin/env node
/**
 * scan-lightmode-breakage.mjs
 *
 * Finds LIGHT-MODE breakages: components that hardcode a dark surface or
 * light-only text with NO semantic token and NO `dark:` counterpart, so they
 * render dark-on-dark (or dark panel on white) when the app is in light theme.
 *
 * The app is dark-first (`.dark` class flips CSS-var tokens over `:root` light
 * defaults). Correct theme-aware code uses tokens (bg-card, text-foreground,
 * bg-background, text-muted-foreground) OR pairs a light base with `dark:`
 * (e.g. `bg-white dark:bg-neutral-900`). Anything that hardcodes only the dark
 * value is a light-mode bug on an in-scope surface.
 *
 * SCOPE: excludes intentionally always-dark editors (canvas, reactflow, 3D
 * studio, image-lab + its sub-controls). Welcome/ASCII/marketing ARE in scope.
 *
 * Usage:
 *   node scripts/scan-lightmode-breakage.mjs            # ranked per-file report
 *   node scripts/scan-lightmode-breakage.mjs --summary  # totals + top files
 *   node scripts/scan-lightmode-breakage.mjs --report   # write JSON to dist/
 *   node scripts/scan-lightmode-breakage.mjs --files    # just the ranked file list
 *   node scripts/scan-lightmode-breakage.mjs --self-test
 *
 * Legitimate line: `EXCEÇÃO ao lightmode/<rule>: reason` on the line or up to
 * 8 lines above. Whole file: `// lightmode-ignore-file: <rule> — reason`.
 * Reason is mandatory, rule name is exact.
 *
 * ALWAYS-DARK STAGE: a file whose JSX declares the bare `dark` class (e.g.
 * `className="dark fixed inset-0 bg-black"`) renders that subtree with the
 * dark tokens in both themes, so nothing in the file is a light-mode breakage.
 * File-level on purpose: the stage's sub-components (AppRow, AppList) live in
 * the same file but outside the element, so element nesting would miss them.
 * Suppressed hits are counted in --summary and the JSON report, not hidden.
 */

import { readdirSync, readFileSync, writeFileSync, statSync, mkdirSync, existsSync } from 'fs';
import { join, relative, extname } from 'path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const SRC_DIR = join(ROOT, 'src');
const ARGS = new Set(process.argv.slice(2));
const SUMMARY = ARGS.has('--summary');
const REPORT = ARGS.has('--report');
const FILES_ONLY = ARGS.has('--files');

const norm = (p) => p.replace(/[\\/]/g, '/');
const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', '__tests__', 'test']);
const SCAN_EXT = new Set(['.tsx', '.jsx']);

// ─── Out-of-scope: intentionally always-dark editors (user decision) ──────────
const EXCLUDE_PATHS = [
  'src/components/canvas/',
  'src/components/reactflow/',
  'src/components/3d-studio/',
  'src/components/3d/',
  'src/components/grid-machine/',
  'src/components/halftone/',
  'src/components/riso/',
  'src/components/texture-filter/',
  'src/components/image-lab/',
  'src/components/creative/',        // Konva creative editor (in /create)
  'src/pages/CanvasPage',
  'src/pages/CreatePage',
  'src/pages/Studio3DPage',
  'src/pages/ImageLabPage',
  'src/pages/EditorPage',
  'src/pages/GridPaintPage',
  'src/pages/GridMachinePage',
  'src/constants/canvasColors',
];

const isExcluded = (rel) => EXCLUDE_PATHS.some((p) => norm(rel).startsWith(p));

// ─── Risk patterns ────────────────────────────────────────────────────────────
// A dark base SURFACE with no token / no light counterpart on the same element.
const DARK_SURFACE = /\b(?:bg-black|bg-neutral-(?:800|900|950)|bg-zinc-(?:800|900|950)|bg-stone-(?:800|900|950)|bg-gray-(?:800|900|950))\b/;
// Light-only TEXT used as a base (invisible on white in light mode).
const LIGHT_TEXT = /\b(?:text-white|text-neutral-(?:100|200|300|400)|text-zinc-(?:100|200|300|400)|text-gray-(?:100|200|300|400))\b/;
// Dark-only borders that vanish on white.
const DARK_BORDER = /\bborder-(?:neutral|zinc|gray|stone)-(?:700|800|900)\b/;

// Signals that a line is already theme-aware or a benign overlay (suppress).
const HAS_DARK_VARIANT = /\bdark:/;
const HAS_LIGHT_COUNTER = /\b(?:bg-white|bg-background|bg-card|bg-popover|bg-muted|bg-secondary|text-foreground|text-muted-foreground|text-card-foreground)\b/;
const IS_OVERLAY = /\/(?:\d{1,2}|\[0?\.\d+\])\b/;          // opacity suffix → likely overlay/scrim
const ON_ACCENT = /bg-(?:brand-cyan|primary|destructive|success|warning|accent|foreground)/; // text-white here is correct

function classify(line) {
  // Skip comments / imports
  const t = line.trimStart();
  if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*') || t.startsWith('import ')) return null;

  const hits = [];

  if (DARK_SURFACE.test(line) && !HAS_DARK_VARIANT.test(line) && !HAS_LIGHT_COUNTER.test(line) && !IS_OVERLAY.test(line)) {
    hits.push('dark-surface-no-token');
  }
  if (LIGHT_TEXT.test(line) && !HAS_DARK_VARIANT.test(line) && !HAS_LIGHT_COUNTER.test(line) && !ON_ACCENT.test(line)) {
    hits.push('light-only-text');
  }
  if (DARK_BORDER.test(line) && !HAS_DARK_VARIANT.test(line) && !IS_OVERLAY.test(line) && !HAS_LIGHT_COUNTER.test(line)) {
    hits.push('dark-only-border');
  }
  return hits.length ? hits : null;
}

// ─── Written exceptions (same contract as scan-design-violations / ui-slop) ───
const RULE_IDS = ['dark-surface-no-token', 'light-only-text', 'dark-only-border'];
const EXCEPTION_WINDOW = 8;
const letters = (s) => (s.match(/\p{L}/gu) ?? []).length;
const EXCEPTION_RE = Object.fromEntries(
  RULE_IDS.map((id) => [
    id,
    new RegExp(String.raw`EXCE(?:Ç|C)(?:Ã|A)O\s+ao\s+lightmode/${id}(?![\w-])\s*:\s*(.*)`, 'i'),
  ])
);

function hasWrittenException(lines, i, ruleId) {
  const re = EXCEPTION_RE[ruleId];
  for (let k = i; k >= Math.max(0, i - EXCEPTION_WINDOW); k--) {
    const m = lines[k].match(re);
    if (!m) continue;
    // The reason may wrap to the next comment line; count both.
    const next = k + 1 <= i ? (lines[k + 1] ?? '').replace(/^\s*(?:\/\/|\*|\/\*|\{\/\*)/, '') : '';
    const head = m[1].replace(/\*\/\}?\s*$/, '');
    if (letters(`${head} ${next}`) >= 8 && /\p{L}{3,}/u.test(head)) return true;
  }
  return false;
}

/** Rules released by "lightmode-ignore-file: <rule> — <reason>". */
function fileExceptions(src) {
  const out = new Set();
  for (const m of src.matchAll(/lightmode-ignore-file:\s*([\w-]+)(.*)/g)) {
    if (!RULE_IDS.includes(m[1])) continue;
    const reason = m[2].replace(/\*\/\}?\s*$/, '').replace(/^[\s—–:-]+/, '');
    if (letters(reason) >= 8) out.add(m[1]);
  }
  return out;
}

/**
 * Does the file declare the bare `dark` class in a class string?
 * A class string = a literal right after `className=`, or a literal with 2+
 * tokens where one looks like a utility (has a dash). That keeps
 * `theme === 'dark'`, `data-theme="dark"` and `dark:bg-x` out.
 */
function declaresDarkStage(src) {
  const isDark = (str) => str.split(/\s+/).includes('dark');
  for (const m of src.matchAll(/className\s*=\s*(?:"([^"]*)"|'([^']*)'|\{\s*["'`]([^"'`]*)["'`]\s*\})/g)) {
    if (isDark(m[1] ?? m[2] ?? m[3] ?? '')) return true;
  }
  for (const m of src.matchAll(/["'`]([^"'`\n]*)["'`]/g)) {
    const toks = m[1].trim().split(/\s+/);
    if (toks.length >= 2 && toks.includes('dark') && toks.some((t) => t.includes('-'))) return true;
  }
  return false;
}

/** Scan one source. Returns hits plus what was suppressed and why. */
function scanSource(src) {
  const lines = src.split('\n');
  const ignored = fileExceptions(src);
  const stage = declaresDarkStage(src);
  const found = [];
  const suppressed = { exception: 0, stage: 0 };
  lines.forEach((line, i) => {
    const hits = classify(line);
    if (!hits) return;
    const kept = [];
    for (const r of hits) {
      if (ignored.has(r) || hasWrittenException(lines, i, r)) suppressed.exception++;
      else if (stage) suppressed.stage++;
      else kept.push(r);
    }
    if (kept.length) found.push({ line: i + 1, rules: kept, code: line.trim().slice(0, 120) });
  });
  return { found, suppressed, stage };
}

// ─── Self-test ────────────────────────────────────────────────────────────────
// A new false positive that escapes: add a case here, never replace one.
if (ARGS.has('--self-test')) {
  const TXT = '<p className="text-white text-xs">x</p>';
  const SURF = '<div className="bg-neutral-900 p-4">';
  const EXC = 'EXCEÇÃO ao lightmode/light-only-text: texto sobre foto escura';
  const IGN = 'lightmode-ignore-file: dark-surface-no-token — player de vídeo é sempre escuro';
  const cases = [
    ['no exception counts', [TXT], 1],
    ['exception on the line above', [`{/* ${EXC} */}`, TXT], 0],
    ['exception on the same line', [`${TXT} {/* ${EXC} */}`], 0],
    ['exception 8 lines above', [`// ${EXC}`, ...Array(7).fill('x'), TXT], 0],
    ['exception 9 lines above (out)', [`// ${EXC}`, ...Array(8).fill('x'), TXT], 1],
    ['exception without reason', ['// EXCEÇÃO ao lightmode/light-only-text:', TXT], 1],
    ['exception for another rule', ['// EXCEÇÃO ao lightmode/dark-only-border: texto sobre foto escura', TXT], 1],
    ['partial rule name', ['// EXCEÇÃO ao lightmode/light-only: texto sobre foto escura', TXT], 1],
    ['exception below does not count', [TXT, `// ${EXC}`], 1],
    ['ignore-file with reason', [`// ${IGN}`, SURF], 0],
    ['ignore-file without reason', ['// lightmode-ignore-file: dark-surface-no-token', SURF], 1],
    ['ignore-file releases only its rule', [`// ${IGN}`, TXT], 1],
    ['stage: className="dark ..."', ['<div className="dark fixed inset-0 bg-black">', TXT, SURF], 0],
    ['stage: className={"dark"}', ["<main className={'dark'}>", TXT], 0],
    ['stage: dark inside cn(...) literal', ["className={cn('dark min-h-screen bg-black', x)}", TXT], 0],
    [
      'stage: sub-component elsewhere in the file',
      [
        'const Row = () => <p className="text-neutral-400 text-xs" />;',
        'export const P = () => <div className="dark bg-black"><Row /></div>;',
      ],
      0,
    ],
    ['not stage: theme === "dark"', ["const c = theme === 'dark' ? 'a' : 'b';", TXT], 1],
    ['not stage: dark: variant', ['<div className="bg-white dark:bg-black">', TXT], 1],
    ['not stage: word dark in copy', ['<p>{"modo dark"}</p>', TXT], 1],
    ['not stage: data-theme="dark"', ['<div data-theme="dark">', TXT], 1],
  ];
  let fail = 0;
  for (const [name, src, expect] of cases) {
    const got = scanSource(src.join('\n')).found.reduce((n, f) => n + f.rules.length, 0);
    const ok = got === expect;
    if (!ok) fail++;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${name}  (expected ${expect}, got ${got})`);
  }
  console.log(fail ? `\n${fail} case(s) failed.` : `\n${cases.length} cases ok.`);
  process.exit(fail ? 1 : 0);
}

function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir)) {
    if (IGNORE_DIRS.has(e)) continue;
    const full = join(dir, e);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full));
    else if (SCAN_EXT.has(extname(e))) out.push(full);
  }
  return out;
}

const files = walk(SRC_DIR);
const perFile = {};
const byRule = { 'dark-surface-no-token': 0, 'light-only-text': 0, 'dark-only-border': 0 };
const suppressed = { exception: 0, stage: 0 };
const stageFiles = [];
let total = 0, scanned = 0, excluded = 0;

for (const f of files) {
  const rel = norm(relative(ROOT, f));
  if (isExcluded(rel)) { excluded++; continue; }
  scanned++;
  const res = scanSource(readFileSync(f, 'utf8'));
  suppressed.exception += res.suppressed.exception;
  suppressed.stage += res.suppressed.stage;
  if (res.stage) stageFiles.push(rel);
  for (const h of res.found) {
    h.rules.forEach((r) => (byRule[r] += 1));
    total += h.rules.length;
  }
  if (res.found.length) perFile[rel] = res.found;
}

const ranked = Object.entries(perFile).sort((a, b) => b[1].length - a[1].length);

// ─── Output ────────────────────────────────────────────────────────────────────
if (FILES_ONLY) {
  for (const [file, hits] of ranked) console.log(`${String(hits.length).padStart(4)}  ${file}`);
} else if (SUMMARY) {
  console.log(`\n  Light-mode breakage scan`);
  console.log(`  scanned ${scanned} files (${excluded} excluded as always-dark)`);
  console.log(`  ${total} candidate breakages in ${ranked.length} files\n`);
  console.log(`  dark-surface-no-token : ${byRule['dark-surface-no-token']}`);
  console.log(`  light-only-text       : ${byRule['light-only-text']}`);
  console.log(`  dark-only-border      : ${byRule['dark-only-border']}`);
  console.log(
    `  suppressed            : ${suppressed.exception} by written exception, ${suppressed.stage} in ${stageFiles.length} always-dark stage file(s)\n`
  );
  console.log(`  Top 25 files:`);
  for (const [file, hits] of ranked.slice(0, 25)) console.log(`  ${String(hits.length).padStart(4)}  ${file}`);
  console.log('');
} else {
  console.log(`\n╔══ Light-mode breakage: ${total} candidates in ${ranked.length} files ══╗\n`);
  for (const [file, hits] of ranked.slice(0, 40)) {
    console.log(`\x1b[36m${file}\x1b[0m  (${hits.length})`);
    for (const h of hits.slice(0, 4)) console.log(`  :${h.line} [${h.rules.join(',')}]  ${h.code}`);
    if (hits.length > 4) console.log(`  ... and ${hits.length - 4} more`);
    console.log('');
  }
}

if (REPORT) {
  const distDir = join(ROOT, 'dist');
  if (!existsSync(distDir)) mkdirSync(distDir);
  const out = join(distDir, 'lightmode-breakage.json');
  writeFileSync(out, JSON.stringify({ scanned, excluded, total, byRule, suppressed, stageFiles, files: perFile }, null, 2));
  console.log(`Report: ${relative(ROOT, out)}\n`);
}
