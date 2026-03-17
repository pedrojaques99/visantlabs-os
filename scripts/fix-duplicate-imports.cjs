/**
 * fix-duplicate-imports.cjs
 * Finds and removes duplicate Button/Input/Textarea imports added by the refactor script.
 * Keeps the first import, removes the duplicate.
 */
const fs = require('fs');
const path = require('path');

const TARGETS = ['Button', 'Input', 'Textarea'];
const APPLY = process.argv.includes('--apply');

function walk(dir, cb) {
  fs.readdirSync(dir).forEach(f => {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) {
      if (p.replace(/\\/g, '/').includes('components/ui')) return;
      walk(p, cb);
    }
    else if (p.endsWith('.tsx')) cb(p);
  });
}

let fixedCount = 0;

['src/pages', 'src/components'].forEach(d => walk(d, filePath => {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const seen = {};
  const linesToRemove = new Set();

  lines.forEach((line, i) => {
    const trimmed = line.trim();
    // Match single-name import: import { Button } from '...'
    for (const target of TARGETS) {
      // Exact single import pattern
      const singlePattern = new RegExp(`^import\\s*\\{\\s*${target}\\s*\\}\\s*from\\s*['\"].*['\"]\\s*;?\\s*$`);
      if (singlePattern.test(trimmed)) {
        if (seen[target]) {
          linesToRemove.add(i);
        } else {
          seen[target] = i + 1;
        }
      }
      // Also check if target is part of a multi-import that also has it separately
      // e.g., import { Badge } from './ui/badge'; and import { Button } from './ui/button'; on separate lines
      // but Button also imported as import { Button } from '@/components/ui/button'
    }

    // Check multi-import lines like: import { Button, buttonVariants } from '...'
    const multiMatch = trimmed.match(/^import\s*\{([^}]+)\}\s*from\s*['"].*['"]\s*;?\s*$/);
    if (multiMatch) {
      const names = multiMatch[1].split(',').map(n => n.trim());
      for (const target of TARGETS) {
        if (names.includes(target) && !singleImportTest(trimmed, target)) {
          // It's in a multi-import
          if (seen[target]) {
            // We already have this import - need to remove from this multi-import
            // But can't remove the whole line, need to remove just the name
            // Skip for now - handled below
          } else {
            seen[target] = i + 1;
          }
        }
      }
    }
  });

  if (linesToRemove.size > 0) {
    const newLines = lines.filter((_, i) => !linesToRemove.has(i));
    const rel = filePath.replace(/\\/g, '/');
    console.log(`${APPLY ? 'FIXED' : 'FOUND'}: ${rel} (removing ${linesToRemove.size} duplicate import line(s))`);
    if (APPLY) {
      fs.writeFileSync(filePath, newLines.join('\n'), 'utf8');
    }
    fixedCount++;
  }
}));

function singleImportTest(line, name) {
  const re = new RegExp(`^import\\s*\\{\\s*${name}\\s*\\}\\s*from`);
  return re.test(line);
}

console.log(`\n${fixedCount} file(s) ${APPLY ? 'fixed' : 'found with duplicates'}.`);
if (!APPLY && fixedCount > 0) {
  console.log('Run with --apply to fix them.');
}
