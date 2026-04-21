import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, '..');
const SRC_DIR = path.join(ROOT_DIR, 'src');
const LOCALES_DIR = path.join(SRC_DIR, 'locales');
const REPORTS_DIR = path.join(ROOT_DIR, 'scripts', 'reports');

const EXCLUDE_DIRS = ['node_modules', '.git', '.next', 'dist', 'build', 'locales'];
const UI_ATTRIBUTES = ['placeholder', 'title', 'label', 'description', 'subtitle', 'error', 'success', 'message'];

const args = new Set(process.argv.slice(2));
const STRICT = args.has('--strict');
// Strict mode runs only the checks that break runtime UX: missing (cross-locale),
// unresolved (src→locale), and param mismatches. Exits with code 1 on any finding.
// Baseline of known-unresolvable dynamic/collision keys lives in scripts/i18n-allowlist.json.
const FLAGS = STRICT
  ? { missing: true, duplicates: false, orphans: false, untranslated: false, paramsMismatch: true, hardcoded: false, unresolved: true }
  : {
      missing: args.has('--missing') || args.size === 0,
      duplicates: args.has('--duplicates') || args.size === 0,
      orphans: args.has('--orphans') || args.size === 0,
      untranslated: args.has('--untranslated') || args.size === 0,
      paramsMismatch: args.has('--params') || args.size === 0,
      hardcoded: args.has('--hardcoded') || args.size === 0,
      unresolved: args.has('--unresolved') || args.size === 0,
    };

function flattenObject(obj, prefix = '') {
  return Object.keys(obj).reduce((acc, k) => {
    const pre = prefix.length ? prefix + '.' : '';
    if (typeof obj[k] === 'object' && obj[k] !== null && !Array.isArray(obj[k])) {
      Object.assign(acc, flattenObject(obj[k], pre + k));
    } else {
      acc[pre + k] = obj[k];
    }
    return acc;
  }, {});
}

function walkDir(dir, callback) {
  for (const file of fs.readdirSync(dir)) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      if (!EXCLUDE_DIRS.includes(file)) walkDir(filePath, callback);
    } else {
      callback(filePath);
    }
  }
}

function findHardcodedStrings(content) {
  const matches = [];
  const jsxTextRegex = />([^<{}>]+)</g;
  let match;
  while ((match = jsxTextRegex.exec(content)) !== null) {
    const text = match[1].trim();
    if (text && text.length > 1 && !/^[0-9\s\W]+$/.test(text)) {
      matches.push({ text, type: 'JSX Text' });
    }
  }
  for (const attr of UI_ATTRIBUTES) {
    const attrRegex = new RegExp(`${attr}=["']([^"']+)["']`, 'g');
    while ((match = attrRegex.exec(content)) !== null) {
      const text = match[1].trim();
      if (text && !text.startsWith('{') && !text.includes('t(')) {
        matches.push({ text, type: `Attribute: ${attr}` });
      }
    }
  }
  return matches;
}

function extractParams(value) {
  if (typeof value !== 'string') return new Set();
  // Strip ICU plural/select bodies so branch labels like {project} aren't misread as placeholders.
  // Matches `{name, plural/select, ...}` and removes everything from the comma onward up to the closing brace.
  const stripped = value.replace(/\{(\w+),\s*(?:plural|select|selectordinal)[\s\S]*?\}\s*\}/g, '{$1}');
  const params = new Set();
  const re = /\{(\w+)\}/g;
  let m;
  while ((m = re.exec(stripped)) !== null) params.add(m[1]);
  return params;
}

function collectUsedKeys(withSites = false) {
  const used = new Set();
  const sites = new Map(); // key -> [{file, line}]
  const patterns = [
    /\bt\(\s*['"`]([^'"`]+)['"`]/g,
    /\btranslate\(\s*['"`]([^'"`]+)['"`]/g,
  ];
  walkDir(SRC_DIR, (filePath) => {
    if (!/\.(tsx?|jsx?|mjs)$/.test(filePath)) return;
    const content = fs.readFileSync(filePath, 'utf8');
    for (const re of patterns) {
      let m;
      while ((m = re.exec(content)) !== null) {
        used.add(m[1]);
        if (withSites) {
          const line = content.slice(0, m.index).split('\n').length;
          if (!sites.has(m[1])) sites.set(m[1], []);
          sites.get(m[1]).push({ file: path.relative(ROOT_DIR, filePath), line });
        }
      }
    }
  });
  if (withSites) return { used, sites };
  return used;
}

function section(title) {
  return `\n${'='.repeat(60)}\n ${title}\n${'='.repeat(60)}\n\n`;
}

function loadAllowlist() {
  const p = path.join(ROOT_DIR, 'scripts', 'i18n-allowlist.json');
  if (!fs.existsSync(p)) return { unresolved: [] };
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return { unresolved: [] }; }
}

function runAudit() {
  let out = `i18n Audit — ${new Date().toISOString()}\n`;
  out += `Flags: ${Object.entries(FLAGS).filter(([,v]) => v).map(([k]) => k).join(', ')}${STRICT ? ' [STRICT]' : ''}\n`;
  const allowlist = loadAllowlist();
  const allowedUnresolved = new Set(allowlist.unresolved || []);
  const failures = { missing: 0, unresolved: 0, paramsMismatch: 0 };

  const enLocale = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, 'en-US.json'), 'utf8'));
  const ptLocale = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, 'pt-BR.json'), 'utf8'));
  const flatEn = flattenObject(enLocale);
  const flatPt = flattenObject(ptLocale);
  const enKeys = Object.keys(flatEn);
  const ptKeys = Object.keys(flatPt);

  out += `\nen-US: ${enKeys.length} keys | pt-BR: ${ptKeys.length} keys\n`;

  // 1. MISSING
  if (FLAGS.missing) {
    out += section('MISSING KEYS');
    const missInPt = enKeys.filter(k => !(k in flatPt));
    const missInEn = ptKeys.filter(k => !(k in flatEn));
    out += `Missing in pt-BR: ${missInPt.length}\n`;
    missInPt.forEach(k => out += `  - ${k}\n`);
    out += `\nMissing in en-US: ${missInEn.length}\n`;
    missInEn.forEach(k => out += `  - ${k}\n`);
    failures.missing = missInPt.length + missInEn.length;
  }

  // 2. DUPLICATES (same value, multiple keys — per locale)
  if (FLAGS.duplicates) {
    out += section('DUPLICATE VALUES (same text, multiple keys)');
    for (const [label, flat] of [['en-US', flatEn], ['pt-BR', flatPt]]) {
      const byValue = new Map();
      for (const [k, v] of Object.entries(flat)) {
        if (typeof v !== 'string' || v.length < 3) continue;
        const norm = v.trim().toLowerCase();
        if (!byValue.has(norm)) byValue.set(norm, []);
        byValue.get(norm).push(k);
      }
      const dupes = [...byValue.entries()].filter(([, keys]) => keys.length > 1);
      out += `\n[${label}] ${dupes.length} duplicated values:\n`;
      dupes
        .sort((a, b) => b[1].length - a[1].length)
        .slice(0, 100)
        .forEach(([val, keys]) => {
          out += `  "${val.slice(0, 80)}" (${keys.length}x)\n`;
          keys.forEach(k => out += `      ${k}\n`);
        });
    }
  }

  // 3. ORPHANS (in locale but never used in src)
  if (FLAGS.orphans) {
    out += section('ORPHAN KEYS (defined but unused in src/)');
    const used = collectUsedKeys();
    const orphans = enKeys.filter(k => {
      if (used.has(k)) return false;
      // Tolerate dynamic prefixes: t('tags.' + x) — keep if any used key starts with parent
      const parent = k.split('.').slice(0, -1).join('.');
      for (const u of used) {
        if (u === k) return false;
        if (u.startsWith(parent + '.') && u.endsWith(k.split('.').pop())) return false;
      }
      return true;
    });
    out += `Found ${orphans.length} orphan keys (review manually — dynamic keys may false-positive):\n`;
    orphans.slice(0, 200).forEach(k => out += `  - ${k}\n`);
    if (orphans.length > 200) out += `  ... and ${orphans.length - 200} more\n`;
  }

  // 4. UNTRANSLATED (identical EN == PT, likely forgotten)
  if (FLAGS.untranslated) {
    out += section('LIKELY UNTRANSLATED (en == pt)');
    const untrans = enKeys.filter(k => {
      const en = flatEn[k];
      const pt = flatPt[k];
      if (typeof en !== 'string' || typeof pt !== 'string') return false;
      if (en.length < 4) return false;
      if (/^[A-Z0-9_\s-]+$/.test(en)) return false; // skip abbreviations/codes
      return en.trim() === pt.trim();
    });
    out += `Found ${untrans.length} keys with identical EN/PT values:\n`;
    untrans.slice(0, 150).forEach(k => out += `  - ${k} = "${flatEn[k]}"\n`);
    if (untrans.length > 150) out += `  ... and ${untrans.length - 150} more\n`;
  }

  // 5. PARAM MISMATCH (interpolation keys differ between locales)
  if (FLAGS.paramsMismatch) {
    out += section('PARAM MISMATCH ({placeholders} differ between locales)');
    const issues = [];
    for (const k of enKeys) {
      if (!(k in flatPt)) continue;
      const enP = extractParams(flatEn[k]);
      const ptP = extractParams(flatPt[k]);
      const missingInPt = [...enP].filter(p => !ptP.has(p));
      const extraInPt = [...ptP].filter(p => !enP.has(p));
      if (missingInPt.length || extraInPt.length) {
        issues.push({ k, missingInPt, extraInPt });
      }
    }
    out += `Found ${issues.length} keys with param mismatch:\n`;
    issues.forEach(({ k, missingInPt, extraInPt }) => {
      out += `  - ${k}\n`;
      if (missingInPt.length) out += `      missing in pt: {${missingInPt.join('}, {')}}\n`;
      if (extraInPt.length) out += `      extra in pt:   {${extraInPt.join('}, {')}}\n`;
    });
    failures.paramsMismatch = issues.length;
  }

  // 6. UNRESOLVED — referenced in src but missing from locale (renders raw key in UI)
  if (FLAGS.unresolved) {
    out += section('UNRESOLVED KEYS (referenced in src/ but not in en-US.json)');
    const { used, sites } = collectUsedKeys(true);
    const enKeySet = new Set(enKeys);
    const allUnresolved = [...used].filter(k => !enKeySet.has(k)).sort();
    const blocking = allUnresolved.filter(k => !allowedUnresolved.has(k));
    const allowed = allUnresolved.filter(k => allowedUnresolved.has(k));
    out += `Blocking (not in allowlist): ${blocking.length}\n`;
    blocking.forEach(k => {
      out += `  - ${k}\n`;
      (sites.get(k) || []).slice(0, 3).forEach(s => out += `      ${s.file}:${s.line}\n`);
    });
    out += `\nAllowlisted (dynamic / known-collisions): ${allowed.length}\n`;
    allowed.forEach(k => out += `  - ${k}\n`);
    failures.unresolved = blocking.length;
  }

  // 7. HARDCODED STRINGS
  if (FLAGS.hardcoded) {
    out += section('HARDCODED STRINGS IN SOURCE');
    const enValues = new Set(Object.values(flatEn));
    const report = [];
    walkDir(SRC_DIR, (filePath) => {
      if (!/\.(tsx?|jsx?)$/.test(filePath)) return;
      const content = fs.readFileSync(filePath, 'utf8');
      const strings = findHardcodedStrings(content);
      const missing = strings.filter(s => !enValues.has(s.text));
      if (missing.length) report.push({ file: path.relative(ROOT_DIR, filePath), strings: missing });
    });
    out += `Found hardcoded strings in ${report.length} files:\n`;
    report.forEach(r => {
      out += `\n${r.file}:\n`;
      r.strings.forEach(s => out += `  - [${s.type}] "${s.text}"\n`);
    });
  }

  out += section('DONE');

  if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });
  const reportPath = path.join(REPORTS_DIR, 'i18n-report.txt');
  fs.writeFileSync(reportPath, out);
  console.log(out);
  console.log(`\nReport saved to: ${path.relative(ROOT_DIR, reportPath)}`);

  if (STRICT) {
    const total = failures.missing + failures.unresolved + failures.paramsMismatch;
    console.log(`\n[STRICT] missing=${failures.missing} unresolved=${failures.unresolved} paramsMismatch=${failures.paramsMismatch}`);
    if (total > 0) {
      console.error(`\n[STRICT] FAIL — ${total} blocking i18n issue(s). To allowlist a dynamic key, edit scripts/i18n-allowlist.json`);
      process.exit(1);
    }
    console.log('[STRICT] OK');
  }
}

runAudit();
