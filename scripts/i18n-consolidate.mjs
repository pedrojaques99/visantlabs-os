#!/usr/bin/env node
/**
 * i18n Consolidation — merge duplicate values into `common.*` namespace.
 *
 * Strategy (safe by default):
 *   1. For every key in locales whose value exactly matches a value in `common.*`
 *      (same string in BOTH en-US and pt-BR), generate a rewrite: old key -> common.key.
 *   2. Rewrite `t('old.key')` / `translate('old.key')` occurrences in src/**.
 *   3. Delete the orphaned keys from both locale files.
 *
 * Guardrails:
 *   - Never touches `common.*` keys themselves.
 *   - Requires exact string match in BOTH locales (case-sensitive).
 *   - Skips values shorter than 3 chars (too ambiguous).
 *   - Dry-run by default: writes plan + summary, changes nothing.
 *
 * Usage:
 *   node scripts/i18n-consolidate.mjs              # dry-run, writes plan
 *   node scripts/i18n-consolidate.mjs --apply      # execute the plan
 *   node scripts/i18n-consolidate.mjs --target=common   # change target namespace
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

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const targetArg = args.find(a => a.startsWith('--target='));
const TARGET_NS = targetArg ? targetArg.split('=')[1] : 'common';
const excludeArg = args.find(a => a.startsWith('--exclude-ns='));
// Taxonomies / domain-specific namespaces whose strings happen to match common UI labels but mean different things.
// e.g. `tags.angle.profile` = "camera profile view", NOT "user profile".
const DEFAULT_EXCLUDES = ['tags', 'apps'];
const EXCLUDE_NS = new Set(
  excludeArg ? excludeArg.split('=')[1].split(',').filter(Boolean) : DEFAULT_EXCLUDES
);
// Specific keys to skip. Found via dry-run warnings review:
//   - messages.leave: "Leave" action coincidentally translated as "Cancel" (likely translation bug, not a real duplicate)
//   - admin.dashboard: mixing admin dashboard concept with generic tab label
const SKIP_KEYS = new Set([
  'messages.leave',
  'admin.dashboard',
]);
const MIN_LEN = 3;

function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
function writeJson(p, obj) { fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n'); }

function flatten(obj, prefix = '') {
  return Object.keys(obj).reduce((acc, k) => {
    const pre = prefix.length ? prefix + '.' : '';
    const v = obj[k];
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      Object.assign(acc, flatten(v, pre + k));
    } else {
      acc[pre + k] = v;
    }
    return acc;
  }, {});
}

function deleteAtPath(obj, dottedKey) {
  const parts = dottedKey.split('.');
  const last = parts.pop();
  let cur = obj;
  const chain = [];
  for (const p of parts) {
    if (!cur || typeof cur !== 'object' || !(p in cur)) return;
    chain.push([cur, p]);
    cur = cur[p];
  }
  if (cur && last in cur) delete cur[last];
  // prune empty parent objects bottom-up
  while (chain.length) {
    const [parent, key] = chain.pop();
    const child = parent[key];
    if (child && typeof child === 'object' && !Array.isArray(child) && Object.keys(child).length === 0) {
      delete parent[key];
    } else {
      break;
    }
  }
}

function walkDir(dir, callback) {
  for (const file of fs.readdirSync(dir)) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      if (!EXCLUDE_DIRS.has(file)) walkDir(filePath, callback);
    } else {
      callback(filePath);
    }
  }
}

function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function buildRewriteMap(flatEn, flatPt) {
  // 1. Collect common.* values as target (value -> targetKey, preferring shorter keys)
  const commonByValue = new Map(); // normalizedValue -> { targetKey, enValue, ptValue }
  for (const [k, v] of Object.entries(flatEn)) {
    if (!k.startsWith(TARGET_NS + '.')) continue;
    if (typeof v !== 'string' || v.length < MIN_LEN) continue;
    const pt = flatPt[k];
    if (typeof pt !== 'string') continue;
    const norm = v.trim();
    const existing = commonByValue.get(norm);
    if (!existing || k.length < existing.targetKey.length) {
      commonByValue.set(norm, { targetKey: k, enValue: v, ptValue: pt });
    }
  }

  // 2. For every non-common key, if both EN and PT match an existing common value -> rewrite
  const rewrites = new Map(); // oldKey -> newKey
  const warnings = []; // { oldKey, newKey, reason }
  for (const [k, v] of Object.entries(flatEn)) {
    if (k.startsWith(TARGET_NS + '.')) continue;
    if (typeof v !== 'string' || v.length < MIN_LEN) continue;
    if (SKIP_KEYS.has(k)) continue;
    const rootNs = k.split('.')[0];
    if (EXCLUDE_NS.has(rootNs)) continue;
    const pt = flatPt[k];
    if (typeof pt !== 'string') continue;
    const match = commonByValue.get(v.trim());
    if (!match) continue;
    if (match.ptValue.trim() !== pt.trim()) continue; // must also match in PT
    if (match.targetKey === k) continue;
    // Semantic guard: flag when source last-segment differs from target last-segment
    // (e.g. messages.leave -> common.cancel — verb "Leave" coincidentally translates to "Cancel")
    const srcTail = k.split('.').pop().toLowerCase();
    const tgtTail = match.targetKey.split('.').pop().toLowerCase();
    const genericContextTails = new Set(['label','title','text','message','button','breadcrumb','seotitle','name']);
    if (srcTail !== tgtTail && !genericContextTails.has(srcTail)) {
      warnings.push({ oldKey: k, newKey: match.targetKey, reason: `last segment mismatch: ${srcTail} → ${tgtTail}` });
    }
    rewrites.set(k, match.targetKey);
  }
  return { rewrites, warnings };
}

function findUsageSites(rewrites) {
  // Returns: Map<filePath, Array<{ oldKey, newKey, count }>>
  const patterns = [
    (key) => new RegExp(`(\\bt\\(\\s*['"\`])${escapeRegex(key)}(['"\`])`, 'g'),
    (key) => new RegExp(`(\\btranslate\\(\\s*['"\`])${escapeRegex(key)}(['"\`])`, 'g'),
  ];
  const byFile = new Map();
  walkDir(SRC_DIR, (filePath) => {
    if (!/\.(tsx?|jsx?|mjs)$/.test(filePath)) return;
    const content = fs.readFileSync(filePath, 'utf8');
    for (const [oldKey, newKey] of rewrites) {
      let total = 0;
      for (const mk of patterns) {
        const re = mk(oldKey);
        const matches = content.match(re);
        if (matches) total += matches.length;
      }
      if (total > 0) {
        if (!byFile.has(filePath)) byFile.set(filePath, []);
        byFile.get(filePath).push({ oldKey, newKey, count: total });
      }
    }
  });
  return byFile;
}

function applyRewritesToFile(filePath, rewritesForFile) {
  let content = fs.readFileSync(filePath, 'utf8');
  const patterns = [
    (key) => new RegExp(`(\\bt\\(\\s*['"\`])${escapeRegex(key)}(['"\`])`, 'g'),
    (key) => new RegExp(`(\\btranslate\\(\\s*['"\`])${escapeRegex(key)}(['"\`])`, 'g'),
  ];
  let totalReplaced = 0;
  for (const { oldKey, newKey } of rewritesForFile) {
    for (const mk of patterns) {
      const re = mk(oldKey);
      content = content.replace(re, (_, pre, post) => {
        totalReplaced++;
        return `${pre}${newKey}${post}`;
      });
    }
  }
  fs.writeFileSync(filePath, content);
  return totalReplaced;
}

function main() {
  const enPath = path.join(LOCALES_DIR, 'en-US.json');
  const ptPath = path.join(LOCALES_DIR, 'pt-BR.json');
  const enLocale = readJson(enPath);
  const ptLocale = readJson(ptPath);
  const flatEn = flatten(enLocale);
  const flatPt = flatten(ptLocale);

  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
  console.log(`Target namespace: ${TARGET_NS}`);
  console.log(`Excluded namespaces: ${[...EXCLUDE_NS].join(', ') || '(none)'}`);
  console.log(`en-US: ${Object.keys(flatEn).length} keys | pt-BR: ${Object.keys(flatPt).length} keys\n`);

  const { rewrites, warnings } = buildRewriteMap(flatEn, flatPt);
  console.log(`Found ${rewrites.size} keys to consolidate into ${TARGET_NS}.* (${warnings.length} with warnings)\n`);

  const byFile = findUsageSites(rewrites);

  // Keys referenced in source vs keys not referenced (safe to delete regardless)
  const rewrittenKeys = new Set();
  let totalOccurrences = 0;
  for (const items of byFile.values()) {
    for (const { oldKey, count } of items) {
      rewrittenKeys.add(oldKey);
      totalOccurrences += count;
    }
  }

  // Group rewrites by target for readable summary
  const byTarget = new Map();
  for (const [oldKey, newKey] of rewrites) {
    if (!byTarget.has(newKey)) byTarget.set(newKey, []);
    byTarget.get(newKey).push(oldKey);
  }

  const plan = {
    mode: APPLY ? 'apply' : 'dry-run',
    targetNamespace: TARGET_NS,
    excludedNamespaces: [...EXCLUDE_NS],
    generatedAt: new Date().toISOString(),
    stats: {
      totalRewrites: rewrites.size,
      filesAffected: byFile.size,
      occurrencesInSrc: totalOccurrences,
      keysWithNoSrcUsage: rewrites.size - rewrittenKeys.size,
      warnings: warnings.length,
    },
    warnings,
    byTarget: Object.fromEntries(
      [...byTarget.entries()]
        .sort((a, b) => b[1].length - a[1].length)
        .map(([target, sources]) => [target, { value: flatEn[target], sources: sources.sort() }])
    ),
    files: Object.fromEntries(
      [...byFile.entries()].map(([f, items]) => [path.relative(ROOT_DIR, f), items])
    ),
  };

  if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });
  const planPath = path.join(REPORTS_DIR, 'i18n-consolidate-plan.json');
  writeJson(planPath, plan);
  console.log(`Plan written to: ${path.relative(ROOT_DIR, planPath)}\n`);

  // Human summary
  console.log('Top 20 consolidations:');
  [...byTarget.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 20)
    .forEach(([target, sources]) => {
      console.log(`  ${target}  ←  ${sources.length} keys  "${String(flatEn[target]).slice(0, 50)}"`);
    });

  if (warnings.length) {
    console.log(`\nWarnings (${warnings.length}) — review in plan JSON:`);
    warnings.slice(0, 20).forEach(w => console.log(`  ${w.oldKey} → ${w.newKey}  (${w.reason})`));
    if (warnings.length > 20) console.log(`  ... and ${warnings.length - 20} more`);
  }

  console.log(`\nStats:`);
  console.log(`  Rewrites planned:       ${rewrites.size}`);
  console.log(`  Src files affected:     ${byFile.size}`);
  console.log(`  Src occurrences:        ${totalOccurrences}`);
  console.log(`  Keys not used in src:   ${rewrites.size - rewrittenKeys.size} (will only be removed from locales)`);
  console.log(`  Warnings (review):      ${warnings.length}`);

  if (!APPLY) {
    console.log('\nDry-run — no files changed. Re-run with --apply to execute.');
    return;
  }

  // === APPLY ===
  console.log('\nApplying…');

  // 1. Rewrite source files
  let totalReplaced = 0;
  let filesTouched = 0;
  for (const [filePath, items] of byFile) {
    const n = applyRewritesToFile(filePath, items);
    if (n > 0) { totalReplaced += n; filesTouched++; }
  }
  console.log(`  Source files rewritten: ${filesTouched} (${totalReplaced} occurrences)`);

  // 2. Delete rewritten keys from locale files
  for (const [oldKey] of rewrites) {
    deleteAtPath(enLocale, oldKey);
    deleteAtPath(ptLocale, oldKey);
  }
  writeJson(enPath, enLocale);
  writeJson(ptPath, ptLocale);

  const newEnCount = Object.keys(flatten(enLocale)).length;
  const newPtCount = Object.keys(flatten(ptLocale)).length;
  console.log(`  Locale files updated: en-US=${newEnCount} keys, pt-BR=${newPtCount} keys`);
  console.log('\nDone. Run `node scripts/i18n-scanner.mjs --duplicates` to verify.');
}

main();
