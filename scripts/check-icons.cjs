#!/usr/bin/env node
// Checks for banned icons imported from lucide-react.
// With --fix (default during build), replaces them automatically.
// Covers: src/, plugin/src/, server/

const fs = require('fs');
const path = require('path');

const FIX = process.argv.includes('--fix');

// Banned icon → approved replacement
const REPLACEMENTS = {
  Sparkles: 'Zap',
  Wand: 'Pencil',
  Wand2: 'Pencil',
  Star: 'Gem',
  StarIcon: 'Gem',
  StarFilled: 'Gem',
  Stars: 'Zap',
  MagicWand: 'Pencil',
  Firework: 'Flame',
};

const BANNED = new Set(Object.keys(REPLACEMENTS));

const ROOTS = ['src', 'plugin/src', 'server'].map((r) =>
  path.resolve(__dirname, '..', r)
);

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? walk(path.join(dir, e.name))
      : (e.name.endsWith('.tsx') || e.name.endsWith('.ts')) && !e.name.endsWith('.d.ts')
      ? [path.join(dir, e.name)]
      : []
  );
}

function fixFile(filePath) {
  let src = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  // Fix import statements: replace banned names in lucide-react imports
  src = src.replace(
    /(from\s+['"]lucide-react['"])/g,
    (match, _full, offset) => {
      // Find the import block for this import statement
      const before = src.slice(0, offset);
      const importStart = before.lastIndexOf('import');
      if (importStart === -1) return match;

      const importBlock = src.slice(importStart, offset + match.length);

      // Check if any banned icon is in this import
      let newBlock = importBlock;
      const usedReplacements = new Map();

      for (const [banned, replacement] of Object.entries(REPLACEMENTS)) {
        const re = new RegExp(`\\b${banned}\\b`, 'g');
        if (re.test(newBlock)) {
          usedReplacements.set(banned, replacement);
          newBlock = newBlock.replace(re, replacement);
          changed = true;
        }
      }

      // Deduplicate imports (if replacement was already imported)
      if (usedReplacements.size > 0) {
        const importMatch = newBlock.match(/\{([^}]+)\}/);
        if (importMatch) {
          const names = importMatch[1].split(',').map(n => n.trim()).filter(Boolean);
          const unique = [...new Set(names)];
          newBlock = newBlock.replace(/\{[^}]+\}/, `{ ${unique.join(', ')} }`);
        }

        // Replace in the full source from importStart to end of match
        src = src.slice(0, importStart) + newBlock + src.slice(offset + match.length);
      }

      return match; // The replacement is done above
    }
  );

  // Simpler approach: do global replacements
  if (!changed) {
    // Re-read since the regex approach above is complex
    src = fs.readFileSync(filePath, 'utf8');
  }

  let result = src;
  const fixedIcons = [];

  for (const [banned, replacement] of Object.entries(REPLACEMENTS)) {
    const re = new RegExp(`\\b${banned}\\b`, 'g');
    if (re.test(result)) {
      result = result.replace(re, replacement);
      fixedIcons.push(`${banned} → ${replacement}`);
    }
  }

  if (fixedIcons.length > 0) {
    // Deduplicate imports in lucide-react import lines
    result = result.replace(
      /import\s*\{([^}]+)\}\s*from\s*['"]lucide-react['"]/g,
      (match, names) => {
        const parts = names.split(',').map(n => n.trim()).filter(Boolean);
        const unique = [...new Set(parts)];
        return `import { ${unique.join(', ')} } from 'lucide-react'`;
      }
    );

    fs.writeFileSync(filePath, result, 'utf8');
    return fixedIcons;
  }

  return null;
}

const violations = [];

for (const root of ROOTS) {
  for (const file of walk(root)) {
    const src = fs.readFileSync(file, 'utf8');
    if (!src.includes('lucide-react')) continue;

    for (const line of src.split('\n')) {
      if (!line.includes('lucide-react')) continue;
      const names = line.match(/\b[A-Z][a-zA-Z0-9]+\b/g) || [];
      for (const name of names) {
        if (BANNED.has(name)) {
          const rel = path.relative(path.resolve(__dirname, '..'), file);
          violations.push({ file: rel, fullPath: file, icon: name });
        }
      }
    }
  }
}

if (violations.length === 0) {
  console.log('\x1b[32m✔ Icon check passed\x1b[0m');
  return;
}

if (!FIX) {
  console.error('\n\x1b[31m✖ BANNED ICONS — remove these before building:\x1b[0m\n');
  for (const { file, icon } of violations) {
    console.error(`  \x1b[33m${icon}\x1b[0m  →  ${file}`);
  }
  console.error('\nBanned: ' + [...BANNED].join(', '));
  console.error('Run with --fix to auto-replace.\n');
  process.exit(1);
}

// Auto-fix mode
const fixedFiles = new Set();
for (const { fullPath } of violations) {
  if (fixedFiles.has(fullPath)) continue;
  const fixes = fixFile(fullPath);
  if (fixes) {
    const rel = path.relative(path.resolve(__dirname, '..'), fullPath);
    console.log(`  \x1b[36m✔ Fixed ${rel}\x1b[0m: ${fixes.join(', ')}`);
    fixedFiles.add(fullPath);
  }
}

console.log(`\n\x1b[32m✔ Auto-fixed ${fixedFiles.size} file(s)\x1b[0m`);
