/**
 * refactor-microtitle.cjs
 *
 * Replaces hardcoded MicroTitle patterns (text-[10px] tracking-widest uppercase
 * or tracking-[0.2em]) with the MicroTitle component.
 *
 * Strategy: Finds <span> or <p> or <h*> or <div> tags whose className contains
 * the MicroTitle pattern and replaces the tag + className with <MicroTitle>.
 *
 * Usage:
 *   node scripts/refactor-microtitle.cjs              # dry-run
 *   node scripts/refactor-microtitle.cjs --apply      # apply
 */
const fs = require('fs');
const path = require('path');

const APPLY = process.argv.includes('--apply');
const SCAN_DIRS = ['src/pages', 'src/components'];
const SKIP_DIRS = ['src/components/ui'];

function walk(dir, cb) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).forEach(f => {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) {
      const rel = p.replace(/\\/g, '/');
      if (SKIP_DIRS.some(s => rel.includes(s))) return;
      walk(p, cb);
    } else if (p.endsWith('.tsx')) cb(p);
  });
}

function hasImport(content, name) {
  return new RegExp(`import\\s*\\{[^}]*\\b${name}\\b[^}]*\\}\\s*from\\s*['"][^'"]*['"]`).test(content);
}

function addImport(content, importName, importPath) {
  if (hasImport(content, importName)) return content;

  const lines = content.split('\n');
  let lastImportEnd = -1;
  let inMultiLine = false;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.match(/^import\s/)) {
      if (trimmed.includes('{') && !trimmed.includes('}')) {
        inMultiLine = true;
      } else if (!inMultiLine) {
        lastImportEnd = i;
      }
    }
    if (inMultiLine && (trimmed.includes('from') && /['"]/.test(trimmed))) {
      lastImportEnd = i;
      inMultiLine = false;
    }
  }

  const stmt = `import { ${importName} } from '${importPath}'`;
  if (lastImportEnd >= 0) {
    lines.splice(lastImportEnd + 1, 0, stmt);
  } else {
    lines.unshift(stmt);
  }
  return lines.join('\n');
}

// MicroTitle detection pattern
const MICRO_PATTERN = /text-\[10px\][\s\S]*?tracking|tracking-\[0\.2em\]/;

// Classes that belong to MicroTitle (will be removed from className since MicroTitle provides them)
const MICRO_CLASSES = [
  'text-[10px]',
  'font-mono',
  'text-neutral-500',
  'uppercase',
  'tracking-widest',
  'tracking-[0.2em]',
];

let stats = { found: 0, modified: 0, files: [] };

SCAN_DIRS.forEach(dir => walk(dir, filePath => {
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;
  const rel = filePath.replace(/\\/g, '/');

  // Check if file has MicroTitle patterns
  if (!MICRO_PATTERN.test(content)) return;

  // Already using MicroTitle import? Check if there are ALSO hardcoded patterns
  const lines = content.split('\n');
  let fileCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!MICRO_PATTERN.test(line)) continue;
    if (/MicroTitle/.test(line)) continue; // Already using component

    fileCount++;
    stats.found++;
  }

  if (fileCount > 0) {
    stats.files.push({ file: rel, count: fileCount });

    if (APPLY) {
      // Add import if needed
      content = addImport(content, 'MicroTitle', '@/components/ui/MicroTitle');

      // Replace patterns: find tags with MicroTitle classes
      // Pattern: <span className="...text-[10px]...tracking-widest...">
      // Replace tag with <MicroTitle>, clean up redundant classes
      content = content.replace(
        /(<)(span|p|h[1-6]|div|label)([\s\r\n]+)([^>]*?className\s*=\s*["'`])([^"'`]*(?:text-\[10px\][\s\S]*?tracking|tracking-\[0\.2em\])[^"'`]*)(["'`])/gm,
        (match, open, tag, ws, classPrefix, classes, classEnd) => {
          // Remove MicroTitle-provided classes
          let remainingClasses = classes;
          for (const cls of MICRO_CLASSES) {
            remainingClasses = remainingClasses.replace(new RegExp(`\\b${cls.replace(/[[\]()./]/g, '\\$&')}\\b`, 'g'), '');
          }
          remainingClasses = remainingClasses.replace(/\s+/g, ' ').trim();

          if (remainingClasses) {
            return `<MicroTitle${ws}${classPrefix}${remainingClasses}${classEnd}`;
          } else {
            // No remaining classes, remove className entirely
            return `<MicroTitle${ws}`;
          }
        }
      );

      // Replace closing tags for the same elements
      // This is trickier - we need to match the closing tag for elements we converted
      // Simple approach: replace </span>, </p>, </h*>, </div>, </label> that follow a MicroTitle open
      // But since we can't perfectly track which closing tag matches, we'll do a simpler approach:
      // Just ensure MicroTitle self-closing or properly closed

      // Actually, MicroTitle renders as a <span> by default, so we need proper closing.
      // Let's handle closing tags by finding lines where we made a replacement and fixing the closing tag.
      // For safety, we'll leave closing tags as-is since MicroTitle accepts children.
      // But we need to change </span> → </MicroTitle> etc. for converted tags.

      // Track what we replaced and fix closing tags
      const convertedTags = new Set();
      content.replace(/<MicroTitle[\s\r\n]/, () => { convertedTags.add(true); return ''; });

      if (convertedTags.size > 0) {
        // Replace closing tags that were originally span/p/div after MicroTitle
        // Use a stack-based approach for safety
        const result = [];
        const tagStack = [];
        const tokenRegex = /(<\/?)(MicroTitle|span|p|h[1-6]|div|label)(\s[^>]*>|>)/g;
        let lastIndex = 0;
        let m;

        while ((m = tokenRegex.exec(content)) !== null) {
          result.push(content.substring(lastIndex, m.index));
          lastIndex = m.index + m[0].length;

          const isClose = m[1] === '</';
          const tagName = m[2];
          const rest = m[3];

          if (!isClose && tagName === 'MicroTitle') {
            tagStack.push('MicroTitle');
            result.push(m[0]);
          } else if (isClose && tagStack.length > 0 && tagStack[tagStack.length - 1] === 'MicroTitle' && tagName !== 'MicroTitle') {
            // This closing tag should be </MicroTitle>
            tagStack.pop();
            result.push(`</MicroTitle>`);
          } else {
            if (isClose && tagStack.length > 0 && tagName === 'MicroTitle') {
              tagStack.pop();
            }
            result.push(m[0]);
          }
        }
        result.push(content.substring(lastIndex));
        content = result.join('');
      }

      if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        stats.modified++;
      }
    }
  }
}));

console.log(`\n${'='.repeat(60)}`);
console.log(`  MicroTitle Refactor`);
console.log(`  Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}`);
console.log(`${'='.repeat(60)}\n`);

console.log(`Hardcoded MicroTitle patterns found: ${stats.found}`);
console.log(`Files affected: ${stats.files.length}`);
if (APPLY) console.log(`Files modified: ${stats.modified}`);

if (stats.files.length > 0) {
  console.log(`\nFiles:`);
  stats.files.sort((a, b) => b.count - a.count);
  for (const f of stats.files) {
    console.log(`  ${f.file} (${f.count})`);
  }
}

if (!APPLY && stats.found > 0) {
  console.log(`\nRun with --apply to fix.`);
}
