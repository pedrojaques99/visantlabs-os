#!/usr/bin/env node
/**
 * i18n Seed Missing — generate placeholder entries for keys referenced in src/
 * but absent from locale files. Humanizes the last key segment (camelCase → "Title Case")
 * for EN; copies EN to PT so the scanner's `untranslated` check surfaces them for later review.
 *
 * This is a stopgap: stops the UI from rendering raw keys. Real translations happen
 * via TMS / manual review of the `untranslated` report.
 *
 * Usage:
 *   node scripts/i18n-seed-missing.mjs          # dry-run, writes plan JSON
 *   node scripts/i18n-seed-missing.mjs --apply  # insert placeholders into locale files
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, '..');
const SRC_DIR = path.join(ROOT_DIR, 'src');
const LOCALES_DIR = path.join(SRC_DIR, 'locales');
const REPORTS_DIR = path.join(ROOT_DIR, 'scripts', 'reports');
const EXCLUDE_DIRS = new Set(['node_modules', '.git', '.next', 'dist', 'build', 'locales']);

const APPLY = process.argv.includes('--apply');

function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
function writeJson(p, obj) { fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n'); }

function flatten(obj, prefix = '') {
  return Object.keys(obj).reduce((acc, k) => {
    const pre = prefix.length ? prefix + '.' : '';
    const v = obj[k];
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) Object.assign(acc, flatten(v, pre + k));
    else acc[pre + k] = v;
    return acc;
  }, {});
}

function walkDir(dir, cb) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    const s = fs.statSync(p);
    if (s.isDirectory()) { if (!EXCLUDE_DIRS.has(f)) walkDir(p, cb); }
    else cb(p);
  }
}

function collectUsedKeys() {
  const used = new Map(); // key -> first site {file, line}
  const patterns = [/\bt\(\s*['"`]([^'"`]+)['"`]/g, /\btranslate\(\s*['"`]([^'"`]+)['"`]/g];
  walkDir(SRC_DIR, (fp) => {
    if (!/\.(tsx?|jsx?|mjs)$/.test(fp)) return;
    const c = fs.readFileSync(fp, 'utf8');
    for (const re of patterns) {
      let m;
      while ((m = re.exec(c)) !== null) {
        if (used.has(m[1])) continue;
        const line = c.slice(0, m.index).split('\n').length;
        used.set(m[1], { file: path.relative(ROOT_DIR, fp), line });
      }
    }
  });
  return used;
}

function humanize(lastSegment) {
  // insert spaces before capitals, capitalize first letter
  return lastSegment
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, c => c.toUpperCase())
    .replace(/\s+/g, ' ')
    .trim();
}

function setAtPath(obj, dottedKey, value) {
  const parts = dottedKey.split('.');
  const last = parts.pop();
  let cur = obj;
  for (const p of parts) {
    if (typeof cur[p] !== 'object' || cur[p] === null || Array.isArray(cur[p])) {
      cur[p] = {};
    }
    cur = cur[p];
  }
  cur[last] = value;
}

function main() {
  const enPath = path.join(LOCALES_DIR, 'en-US.json');
  const ptPath = path.join(LOCALES_DIR, 'pt-BR.json');
  const enLocale = readJson(enPath);
  const ptLocale = readJson(ptPath);
  const flatEn = flatten(enLocale);

  const used = collectUsedKeys();
  const unresolved = [...used.entries()].filter(([k]) => !(k in flatEn));

  // Skip dynamic keys (contain template placeholders the scanner captured literally)
  const dynamic = unresolved.filter(([k]) => k.includes('${') || k.includes('{'));
  const resolvable = unresolved.filter(([k]) => !k.includes('${') && !k.includes('{'));

  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
  console.log(`Unresolved keys total: ${unresolved.length}`);
  console.log(`  Dynamic (skipped):   ${dynamic.length}`);
  console.log(`  Resolvable:          ${resolvable.length}\n`);

  const plan = {
    mode: APPLY ? 'apply' : 'dry-run',
    generatedAt: new Date().toISOString(),
    stats: { total: unresolved.length, dynamic: dynamic.length, resolvable: resolvable.length },
    seed: {},
    skipped: dynamic.map(([k, site]) => ({ key: k, site })),
  };

  for (const [key, site] of resolvable) {
    const last = key.split('.').pop();
    const enValue = humanize(last);
    plan.seed[key] = { en: enValue, pt: enValue, site };
  }

  if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });
  const planPath = path.join(REPORTS_DIR, 'i18n-seed-plan.json');
  writeJson(planPath, plan);
  console.log(`Plan written: ${path.relative(ROOT_DIR, planPath)}\n`);

  console.log('Sample (first 15):');
  resolvable.slice(0, 15).forEach(([k]) => {
    console.log(`  ${k}  →  "${plan.seed[k].en}"`);
  });

  if (dynamic.length) {
    console.log(`\nDynamic keys skipped (need manual fix):`);
    dynamic.slice(0, 10).forEach(([k, site]) => console.log(`  ${k}  (${site.file}:${site.line})`));
  }

  if (!APPLY) {
    console.log(`\nDry-run — no files changed. Re-run with --apply to execute.`);
    return;
  }

  for (const [key] of resolvable) {
    const last = key.split('.').pop();
    const value = humanize(last);
    setAtPath(enLocale, key, value);
    setAtPath(ptLocale, key, value); // PT = EN placeholder → scanner's `untranslated` check will surface
  }
  writeJson(enPath, enLocale);
  writeJson(ptPath, ptLocale);

  const newCount = Object.keys(flatten(enLocale)).length;
  console.log(`\nSeeded ${resolvable.length} keys. Locale now has ${newCount} keys.`);
  console.log(`Next: translate pt-BR placeholders — run \`node scripts/i18n-scanner.mjs --untranslated\` to list them.`);
}

main();
