import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, '..');
const SRC_DIR = path.join(ROOT_DIR, 'src');
const LOCALES_DIR = path.join(SRC_DIR, 'locales');
const REPORTS_DIR = path.join(ROOT_DIR, 'scripts', 'reports');

const EXCLUDE_DIRS = ['node_modules', '.git', '.next', 'dist', 'build', 'locales'];
// Pages/files where hardcoded English is intentional (docs, legal, static content)
const HARDCODED_SKIP_FILES = new Set([
  'DocsPage.tsx', 'PrivacyPolicyPage.tsx', 'TermsOfService.tsx',
  'UsagePolicyPage.tsx', 'ApiKeyPolicyModal.tsx', 'ThankYouProPage.tsx',
  'ThankYouProAnualPage.tsx', 'ThankYouVisionPage.tsx', 'ThankYouVisionAnualPage.tsx',
  'OnboardPage.tsx', 'AppEditDialog.tsx', 'DesignSystemPage.tsx',
  'PluginPage.tsx', 'SmartAnalyzerPage.tsx',
]);
const UI_ATTRIBUTES = ['placeholder', 'title', 'label', 'description', 'subtitle', 'error', 'success', 'message'];

const args = new Set(process.argv.slice(2));
const STRICT = args.has('--strict');
const PAGES_ONLY = args.has('--pages');
const FIX_MODE = args.has('--fix');
// Strict mode runs only the checks that break runtime UX: missing (cross-locale),
// unresolved (src→locale), and param mismatches. Exits with code 1 on any finding.
// Baseline of known-unresolvable dynamic/collision keys lives in scripts/i18n-allowlist.json.
const FLAGS = STRICT
  ? { missing: true, duplicates: false, orphans: false, untranslated: false, paramsMismatch: true, hardcoded: false, unresolved: true }
  : PAGES_ONLY || FIX_MODE
    ? { missing: false, duplicates: false, orphans: false, untranslated: false, paramsMismatch: false, hardcoded: true, unresolved: false }
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

// Noise patterns that are NOT user-visible strings
const NOISE_PATTERNS = [
  /^\(/, /^\)/, /^\[/, /^\]/, /^\{/, /^\}/,       // code fragments
  /^[.,:;!?|&=<>+\-*/\\@#$%^~`]+$/,              // punctuation-only
  /^[0-9.,%:x×\s\-+*/=]+$/,                        // numbers/math
  /^(null|undefined|true|false|void|return|const|let|var|if|else|switch|case|break|default|import|export|from|async|await|function|class|new|this|typeof|instanceof)$/, // JS keywords
  /^(string|number|boolean|object|any|never|unknown|React|Promise|Record|Partial|Omit|Pick|Set|Map|Array)/, // TS types
  /^[a-z][a-zA-Z0-9]*\(/, /\);\s*$/, /=>\s*{/,    // function calls / arrow funcs
  /^\$\{/, /\$\{.*\}$/, /^`.*`$/,                  // template literals
  /^[A-Z_][A-Z0-9_]*$/, // CONSTANT_CASE (likely enum/const)
  /^(https?:|mailto:|\/[a-z]|#|data:)/, // URLs/paths
  /^[\w.-]+\.(tsx?|jsx?|json|svg|png|jpg|gif|webp|css|scss|mjs|woff2?|ttf|ico|pdf)$/i, // file refs
  /^(text-|bg-|border-|rounded-|flex-|grid-|p-|m-|w-|h-|gap-|space-|font-|tracking-|leading-)/, // tailwind
  /^(sm:|md:|lg:|xl:|2xl:)/, // tailwind breakpoints
  /^\d+(px|rem|em|vh|vw|%|s|ms)$/, // CSS units
  /^(useState|useEffect|useCallback|useRef|useMemo|useContext|useReducer|useLayoutEffect)/, // hooks
  /^(React\.|e\.|ev\.|event\.|props\.|state\.|ref\.|store\.)/, // common prefixes
  /^\w+\s*[=!<>]+\s*\w+/, // comparisons
  /^(application\/|image\/|video\/|text\/)/, // MIME types
  /\bsetState\b|\bset[A-Z]/, // setter calls
  /^\s*(\/\/|\/\*|\*\/)/, // comment markers
  /^(Bearer|POST|GET|PUT|DELETE|PATCH|HTTP|JSON|API|SDK|CLI|URL|SSE|REST|MCP|JWT)\b/, // tech terms
  /^npm\s/, /^npx\s/, /^curl\s/, /^git\s/, // CLI commands
  /^\w+:\s*\w+$/, // "key: value" patterns
  /^[a-z_]+\.[a-z_]+/i, // dot-separated identifiers
];

function isNoise(text) {
  if (text.length <= 2) return true;
  if (text.length > 200) return true;
  for (const pat of NOISE_PATTERNS) { if (pat.test(text)) return true; }
  // Skip if looks like code: contains =>  or  ; or  { or ) or useState
  if (/[;{}()=]/.test(text) && !/^[A-Z]/.test(text)) return true;
  // Skip if more than 30% non-alpha characters (likely code, not prose)
  const alpha = text.replace(/[^a-zA-ZÀ-ÿ\s]/g, '').length;
  if (alpha / text.length < 0.6) return true;
  return false;
}

function findHardcodedStrings(content, filePath) {
  const matches = [];
  const lines = content.split('\n');
  const alreadyUsesT = /\buseTranslation\b/.test(content) || /\bimport.*\bt\b.*from/.test(content);

  // 1. Find JSX text: literal strings between > and < in JSX context
  //    We check that the line looks like JSX (has < or > or is indented inside a return)
  let inReturn = false;
  let braceDepth = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Track return() blocks roughly
    if (/\breturn\s*\(/.test(trimmed)) { inReturn = true; braceDepth = 0; }
    if (inReturn) {
      braceDepth += (trimmed.match(/\(/g) || []).length;
      braceDepth -= (trimmed.match(/\)/g) || []).length;
      if (braceDepth <= 0 && i > 0) inReturn = false;
    }

    // Only scan lines that look like JSX (contain < or are inside return block)
    if (!inReturn && !/<\w/.test(line) && !/^\s*['"`]/.test(line)) continue;

    // JSX text: >Some text< patterns on this line
    const jsxRe = />([^<{}>]+)</g;
    let m;
    while ((m = jsxRe.exec(line)) !== null) {
      const text = m[1].trim();
      if (!isNoise(text)) {
        matches.push({ text, type: 'JSX Text', line: i + 1 });
      }
    }
  }

  // 2. UI attributes: placeholder="...", title="...", etc.
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const attr of UI_ATTRIBUTES) {
      const attrRe = new RegExp(`${attr}=["']([^"']{3,})["']`, 'g');
      let m;
      while ((m = attrRe.exec(line)) !== null) {
        const text = m[1].trim();
        if (!text.startsWith('{') && !text.includes('t(') && !isNoise(text)) {
          matches.push({ text, type: `Attribute: ${attr}`, line: i + 1 });
        }
      }
    }
  }

  // 3. toast/alert/confirm strings: toast.success('...'), toast.error('...')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const toastRe = /(?:toast\.\w+|alert|confirm|window\.alert)\(\s*['"`]([^'"`]{3,})['"`]/g;
    let m;
    while ((m = toastRe.exec(line)) !== null) {
      const text = m[1].trim();
      if (!text.includes('t(') && !isNoise(text)) {
        matches.push({ text, type: 'Toast/Alert', line: i + 1 });
      }
    }
  }

  // 4. SEO strings: title="...", description="..." in Helmet/SEO components
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const seoRe = /(?:title|description)=["']([^"']{5,})["']/g;
    let m;
    while ((m = seoRe.exec(line)) !== null) {
      const text = m[1].trim();
      if (!text.includes('t(') && !isNoise(text) && !matches.some(x => x.text === text && x.line === i + 1)) {
        matches.push({ text, type: 'SEO', line: i + 1 });
      }
    }
  }

  return { matches, alreadyUsesT };
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
    const scanDir = PAGES_ONLY ? path.join(SRC_DIR, 'pages') : SRC_DIR;
    const modeLabel = PAGES_ONLY ? 'PAGES' : 'SOURCE';
    out += section(`HARDCODED STRINGS IN ${modeLabel}`);
    const enValues = new Set(Object.values(flatEn));
    const report = [];
    let totalStrings = 0;
    walkDir(scanDir, (filePath) => {
      if (!/\.(tsx?|jsx?)$/.test(filePath)) return;
      if (HARDCODED_SKIP_FILES.has(path.basename(filePath))) return;
      const content = fs.readFileSync(filePath, 'utf8');
      const { matches, alreadyUsesT } = findHardcodedStrings(content, filePath);
      const missing = matches.filter(s => !enValues.has(s.text));
      if (missing.length) {
        totalStrings += missing.length;
        report.push({ file: path.relative(ROOT_DIR, filePath), strings: missing, alreadyUsesT });
      }
    });
    // Sort by count descending for priority
    report.sort((a, b) => b.strings.length - a.strings.length);
    out += `Found ${totalStrings} hardcoded strings across ${report.length} files:\n`;
    report.forEach(r => {
      const badge = r.alreadyUsesT ? '' : ' [NO useTranslation]';
      out += `\n${r.file}${badge} (${r.strings.length} strings):\n`;
      r.strings.forEach(s => out += `  L${s.line} [${s.type}] "${s.text.slice(0, 100)}"\n`);
    });

    // --fix mode: generate i18n keys and write a patch plan
    if (FIX_MODE) {
      out += section('FIX PLAN');
      const fixPlan = { generatedAt: new Date().toISOString(), files: [] };
      for (const r of report) {
        const fileBase = path.basename(r.file, path.extname(r.file))
          .replace(/Page$/, '').replace(/([A-Z])/g, (m, c, i) => i ? '.' + c.toLowerCase() : c.toLowerCase());
        const namespace = fileBase || 'common';
        const entries = [];
        const usedSlugs = new Set();
        for (const s of r.strings) {
          // Generate a slug from the text
          let slug = s.text
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, '')
            .trim()
            .replace(/\s+/g, '_')
            .slice(0, 40)
            .replace(/_+$/, '');
          if (!slug || slug.length < 2) slug = 'label_' + s.line;
          // Dedupe
          let finalSlug = slug;
          let c = 2;
          while (usedSlugs.has(finalSlug)) { finalSlug = slug + '_' + c++; }
          usedSlugs.add(finalSlug);

          const key = `${namespace}.${finalSlug}`;
          entries.push({ key, text: s.text, line: s.line, type: s.type });
        }
        fixPlan.files.push({ file: r.file, alreadyUsesT: r.alreadyUsesT, namespace, entries });
      }

      // Write fix plan JSON
      const fixPlanPath = path.join(REPORTS_DIR, 'i18n-fix-plan.json');
      if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });
      fs.writeFileSync(fixPlanPath, JSON.stringify(fixPlan, null, 2) + '\n');
      out += `Fix plan written to: ${path.relative(ROOT_DIR, fixPlanPath)}\n`;
      out += `Total: ${fixPlan.files.length} files, ${totalStrings} strings to extract.\n\n`;

      // Print summary per file
      fixPlan.files.forEach(f => {
        out += `${f.file} → namespace "${f.namespace}" (${f.entries.length} keys)\n`;
        f.entries.slice(0, 5).forEach(e => {
          out += `  L${e.line}: "${e.text.slice(0, 50)}" → t('${e.key}')\n`;
        });
        if (f.entries.length > 5) out += `  ... +${f.entries.length - 5} more\n`;
      });
    }
  }

  out += section('DONE');

  if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });
  const reportPath = path.join(REPORTS_DIR, 'i18n-report.txt');
  fs.writeFileSync(reportPath, out);
  console.log(out);
  console.log(`\nReport saved to: ${path.relative(ROOT_DIR, reportPath)}`);

  // Check for [PT] placeholder values in pt-BR (always runs in strict mode)
  if (STRICT) {
    const placeholderRe = /^\[PT\]\s*/;
    const placeholders = ptKeys.filter(k => typeof flatPt[k] === 'string' && placeholderRe.test(flatPt[k]));
    if (placeholders.length > 0) {
      out += section('PLACEHOLDER VALUES ([PT] prefix in pt-BR)');
      out += `Found ${placeholders.length} values with [PT] prefix:\n`;
      placeholders.forEach(k => out += `  - ${k} = "${flatPt[k]}"\n`);
      failures.placeholders = placeholders.length;
    }
  }

  if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });
  const reportPathFinal = path.join(REPORTS_DIR, 'i18n-report.txt');
  fs.writeFileSync(reportPathFinal, out);

  if (STRICT) {
    const total = failures.missing + failures.unresolved + failures.paramsMismatch + (failures.placeholders || 0);
    console.log(`\n[STRICT] missing=${failures.missing} unresolved=${failures.unresolved} paramsMismatch=${failures.paramsMismatch} placeholders=${failures.placeholders || 0}`);
    if (total > 0) {
      console.error(`\n[STRICT] FAIL — ${total} blocking i18n issue(s). To allowlist a dynamic key, edit scripts/i18n-allowlist.json`);
      process.exit(1);
    }
    console.log('[STRICT] OK');
  }
}

if (args.has('--help') || args.has('-h')) {
  console.log(`
i18n Scanner — Visant Labs

Usage: node scripts/i18n-scanner.mjs [flags]

Flags:
  (none)          Run all checks (missing, duplicates, orphans, untranslated, params, hardcoded, unresolved)
  --missing       Only check missing keys across locales
  --duplicates    Only check duplicate values
  --orphans       Only check orphan keys (defined but unused)
  --untranslated  Only check identical EN/PT values
  --params        Only check param mismatches
  --hardcoded     Only check hardcoded strings in source
  --unresolved    Only check unresolved keys (in src but not in locale)
  --strict        CI mode — missing + unresolved + params. Exits 1 on failure.
  --pages         Focus hardcoded scan on src/pages/ only (skips docs/legal/design-system)
  --fix           Generate i18n-fix-plan.json with suggested keys for every hardcoded string
  --help, -h      Show this help

Examples:
  node scripts/i18n-scanner.mjs --pages           # Quick scan of pages only
  node scripts/i18n-scanner.mjs --pages --fix      # Pages scan + generate fix plan JSON
  node scripts/i18n-scanner.mjs --strict           # CI gate
  node scripts/i18n-scanner.mjs --hardcoded        # Full hardcoded scan across all src/
`);
  process.exit(0);
}

runAudit();
