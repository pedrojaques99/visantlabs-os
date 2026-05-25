/**
 * i18n Placeholder Fixer
 *
 * Strips "[PT] " prefix from pt-BR.json values.
 * If the remaining text is English, copies the en-US value (if it exists).
 *
 * Usage:
 *   node scripts/i18n-fix-placeholders.mjs          # dry-run (report only)
 *   node scripts/i18n-fix-placeholders.mjs --fix     # apply fixes
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const PT_PATH = path.join(ROOT, 'src', 'locales', 'pt-BR.json');
const EN_PATH = path.join(ROOT, 'src', 'locales', 'en-US.json');
const FIX = process.argv.includes('--fix');

function flatten(obj, prefix = '') {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(out, flatten(v, key));
    } else {
      out[key] = v;
    }
  }
  return out;
}

function setNested(obj, dotKey, value) {
  const parts = dotKey.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!(parts[i] in cur) || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

const ptRaw = fs.readFileSync(PT_PATH, 'utf8');
const pt = JSON.parse(ptRaw);
const en = JSON.parse(fs.readFileSync(EN_PATH, 'utf8'));
const flatPt = flatten(pt);
const flatEn = flatten(en);

const PLACEHOLDER_RE = /^\[PT\]\s*/;
const fixes = [];

for (const [key, value] of Object.entries(flatPt)) {
  if (typeof value !== 'string') continue;
  if (!PLACEHOLDER_RE.test(value)) continue;

  const stripped = value.replace(PLACEHOLDER_RE, '');
  const enValue = flatEn[key];

  let newValue;
  if (enValue && typeof enValue === 'string') {
    newValue = stripped || enValue;
  } else {
    newValue = stripped;
  }

  fixes.push({ key, old: value, new: newValue, hadEnglish: !!enValue });
}

console.log(`\n[i18n-fix-placeholders] Found ${fixes.length} "[PT]" placeholder(s) in pt-BR.json\n`);

if (fixes.length === 0) {
  console.log('Nothing to fix.');
  process.exit(0);
}

fixes.forEach(f => {
  console.log(`  ${f.key}`);
  console.log(`    - ${f.old}`);
  console.log(`    + ${f.new}\n`);
});

if (!FIX) {
  console.log(`Dry run. Pass --fix to apply ${fixes.length} fix(es).\n`);
  process.exit(0);
}

for (const f of fixes) {
  setNested(pt, f.key, f.new);
}

fs.writeFileSync(PT_PATH, JSON.stringify(pt, null, 2) + '\n', 'utf8');
console.log(`Applied ${fixes.length} fix(es) to pt-BR.json\n`);
