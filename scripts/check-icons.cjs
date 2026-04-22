#!/usr/bin/env node
// Fails if banned icons are imported from lucide-react anywhere in the codebase.
// Covers: src/, plugin/src/, server/
// To add a ban: extend BANNED below.

const fs = require('fs');
const path = require('path');

const BANNED = new Set([
  'Sparkles', 'Wand', 'Wand2', 'Star', 'StarIcon', 'StarFilled', 'Stars',
  'MagicWand', 'Firework',
]);

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
          violations.push({ file: rel, icon: name });
        }
      }
    }
  }
}

if (violations.length > 0) {
  console.error('\n\x1b[31m✖ BANNED ICONS — remove these before building:\x1b[0m\n');
  for (const { file, icon } of violations) {
    console.error(`  \x1b[33m${icon}\x1b[0m  →  ${file}`);
  }
  console.error('\nBanned: ' + [...BANNED].join(', ') + '\n');
  process.exit(1);
}

console.log('\x1b[32m✔ Icon check passed\x1b[0m');
