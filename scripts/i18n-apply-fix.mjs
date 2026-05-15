#!/usr/bin/env node
/**
 * i18n Apply Fix — reads i18n-fix-plan.json and:
 * 1. Replaces hardcoded strings in source files with t('key') calls
 * 2. Adds useTranslation import if missing
 * 3. Seeds keys into en-US.json and pt-BR.json
 *
 * Usage:
 *   node scripts/i18n-apply-fix.mjs              # dry-run
 *   node scripts/i18n-apply-fix.mjs --apply      # apply changes
 *   node scripts/i18n-apply-fix.mjs --apply --file AdminProductsPage.tsx  # single file
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, '..');
const LOCALES_DIR = path.join(ROOT_DIR, 'src', 'locales');
const REPORTS_DIR = path.join(ROOT_DIR, 'scripts', 'reports');

const APPLY = process.argv.includes('--apply');
const FILE_FILTER = (() => {
  const idx = process.argv.indexOf('--file');
  return idx !== -1 ? process.argv[idx + 1] : null;
})();

function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
function writeJson(p, obj) { fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n'); }

function setAtPath(obj, dottedKey, value) {
  const parts = dottedKey.split('.');
  const last = parts.pop();
  let cur = obj;
  for (const p of parts) {
    if (typeof cur[p] !== 'object' || cur[p] === null || Array.isArray(cur[p])) cur[p] = {};
    cur = cur[p];
  }
  if (cur[last] === undefined) cur[last] = value;
}

function getAtPath(obj, dottedKey) {
  const parts = dottedKey.split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[p];
  }
  return cur;
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function cleanKey(rawKey) {
  // Improve auto-generated key names
  return rawKey
    .replace(/[àáâã]/g, 'a').replace(/[éê]/g, 'e').replace(/[íî]/g, 'i')
    .replace(/[óôõ]/g, 'o').replace(/[úû]/g, 'u').replace(/[ç]/g, 'c')
    .replace(/[^a-zA-Z0-9_.]/g, '_')
    .replace(/_+/g, '_')
    .replace(/_$/, '')
    .slice(0, 50);
}

function main() {
  const planPath = path.join(REPORTS_DIR, 'i18n-fix-plan.json');
  if (!fs.existsSync(planPath)) {
    console.error('No fix plan found. Run: node scripts/i18n-scanner.mjs --pages --fix');
    process.exit(1);
  }

  const plan = readJson(planPath);
  const enPath = path.join(LOCALES_DIR, 'en-US.json');
  const ptPath = path.join(LOCALES_DIR, 'pt-BR.json');
  const enLocale = readJson(enPath);
  const ptLocale = readJson(ptPath);

  let filesModified = 0;
  let stringsReplaced = 0;
  let keysAdded = 0;
  const skipped = [];

  const files = FILE_FILTER
    ? plan.files.filter(f => path.basename(f.file) === FILE_FILTER)
    : plan.files;

  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
  console.log(`Files to process: ${files.length}/${plan.files.length}\n`);

  for (const fileEntry of files) {
    const filePath = path.join(ROOT_DIR, fileEntry.file.replace(/\\/g, path.sep));
    if (!fs.existsSync(filePath)) {
      skipped.push({ file: fileEntry.file, reason: 'file not found' });
      continue;
    }

    let content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    let modified = false;
    let fileReplacements = 0;

    // Clean up key names
    const entries = fileEntry.entries.map(e => ({
      ...e,
      key: cleanKey(e.key),
    }));

    // Process entries from bottom to top (so line numbers stay valid)
    const sortedEntries = [...entries].sort((a, b) => b.line - a.line);

    for (const entry of sortedEntries) {
      const lineIdx = entry.line - 1;
      if (lineIdx < 0 || lineIdx >= lines.length) {
        skipped.push({ file: fileEntry.file, text: entry.text, reason: 'line out of range' });
        continue;
      }

      const line = lines[lineIdx];
      const escaped = escapeRegex(entry.text);

      let newLine = null;

      if (entry.type === 'JSX Text') {
        // Replace >Text< with >{t('key')}<
        // Handle: >Text<  or  >  Text  <
        const jsxRe = new RegExp(`(>\\s*)${escaped}(\\s*<)`);
        if (jsxRe.test(line)) {
          newLine = line.replace(jsxRe, `$1{t('${entry.key}')}$2`);
        }
      } else if (entry.type.startsWith('Attribute:')) {
        // Replace attr="Text" with attr={t('key')}
        const attr = entry.type.replace('Attribute: ', '');
        const attrRe = new RegExp(`(${attr}=)["']${escaped}["']`);
        if (attrRe.test(line)) {
          newLine = line.replace(attrRe, `$1{t('${entry.key}')}`);
        }
      } else if (entry.type === 'Toast/Alert') {
        // Replace 'Text' or "Text" with t('key') inside toast/alert calls
        const toastRe = new RegExp(`(['"\`])${escaped}\\1`);
        if (toastRe.test(line)) {
          newLine = line.replace(toastRe, `t('${entry.key}')`);
        }
      } else if (entry.type === 'SEO') {
        // Replace title="Text" or description="Text" with title={t('key')}
        const seoRe = new RegExp(`((?:title|description)=)["']${escaped}["']`);
        if (seoRe.test(line)) {
          newLine = line.replace(seoRe, `$1{t('${entry.key}')}`);
        }
      }

      if (newLine && newLine !== line) {
        lines[lineIdx] = newLine;
        modified = true;
        fileReplacements++;

        // Seed locale keys
        const existingEn = getAtPath(enLocale, entry.key);
        if (existingEn === undefined) {
          // Detect language of original text (simple heuristic)
          const isPt = /[àáâãéêíóôõúçÀ-ÿ]/.test(entry.text) ||
            /\b(de|do|da|dos|das|para|com|por|sem|não|ou|que|uma?|esse?a?|este?a?)\b/i.test(entry.text);

          if (isPt) {
            setAtPath(ptLocale, entry.key, entry.text);
            // Generate English placeholder
            setAtPath(enLocale, entry.key, `[EN] ${entry.text}`);
          } else {
            setAtPath(enLocale, entry.key, entry.text);
            // Generate Portuguese placeholder
            setAtPath(ptLocale, entry.key, `[PT] ${entry.text}`);
          }
          keysAdded++;
        }
      } else if (!newLine) {
        skipped.push({ file: fileEntry.file, line: entry.line, text: entry.text.slice(0, 40), reason: 'pattern not found on line' });
      }
    }

    // Add useTranslation import if needed
    if (modified && !fileEntry.alreadyUsesT) {
      const importLine = "import { useTranslation } from '@/hooks/useTranslation';";
      if (!content.includes('useTranslation')) {
        // Find last import line
        let lastImportIdx = -1;
        for (let i = 0; i < lines.length; i++) {
          if (/^import\s/.test(lines[i].trim())) lastImportIdx = i;
        }
        if (lastImportIdx >= 0) {
          lines.splice(lastImportIdx + 1, 0, importLine);
        } else {
          lines.unshift(importLine);
        }
      }

      // Add const { t } = useTranslation(); inside the component
      // Find the first line that looks like a component function body
      const newContent = lines.join('\n');
      if (!newContent.includes('useTranslation()')) {
        for (let i = 0; i < lines.length; i++) {
          const l = lines[i].trim();
          // Look for component function opening: export default function X() { or const X = () => {
          if (/^(export\s+)?(default\s+)?function\s+\w+/.test(l) ||
              /^(export\s+)?const\s+\w+.*=.*\(/.test(l)) {
            // Find the opening brace
            for (let j = i; j < Math.min(i + 5, lines.length); j++) {
              if (lines[j].includes('{')) {
                // Insert after the opening brace line
                const indent = lines[j + 1] ? lines[j + 1].match(/^(\s*)/)?.[1] || '  ' : '  ';
                lines.splice(j + 1, 0, `${indent}const { t } = useTranslation();`);
                break;
              }
            }
            break;
          }
        }
      }
    }

    if (modified) {
      filesModified++;
      stringsReplaced += fileReplacements;
      const newContent = lines.join('\n');
      console.log(`✓ ${fileEntry.file} — ${fileReplacements} replacements`);

      if (APPLY) {
        fs.writeFileSync(filePath, newContent);
      }
    }
  }

  if (APPLY) {
    writeJson(enPath, enLocale);
    writeJson(ptPath, ptLocale);
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(`Files modified: ${filesModified}`);
  console.log(`Strings replaced: ${stringsReplaced}`);
  console.log(`Locale keys added: ${keysAdded}`);
  if (skipped.length) {
    console.log(`\nSkipped (${skipped.length}):`);
    skipped.slice(0, 30).forEach(s => {
      console.log(`  ${s.file}${s.line ? ':' + s.line : ''} — ${s.reason}${s.text ? ': "' + s.text + '"' : ''}`);
    });
    if (skipped.length > 30) console.log(`  ... +${skipped.length - 30} more`);
  }

  if (!APPLY) {
    console.log(`\nDry-run — no files changed. Re-run with --apply to execute.`);
  } else {
    console.log(`\nDone! Run \`node scripts/i18n-scanner.mjs --pages\` to verify.`);
  }
}

main();
