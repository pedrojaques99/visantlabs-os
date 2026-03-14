/**
 * classify-buttons.cjs
 * Analyzes <Button> className patterns and adds the correct variant prop.
 *
 * Usage:
 *   node scripts/classify-buttons.cjs              # dry-run (report)
 *   node scripts/classify-buttons.cjs --apply      # apply changes
 */
const fs = require('fs');
const path = require('path');

const APPLY = process.argv.includes('--apply');

function walk(dir, cb) {
  fs.readdirSync(dir).forEach(f => {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) {
      if (p.replace(/\\/g, '/').includes('components/ui')) return;
      walk(p, cb);
    } else if (p.endsWith('.tsx')) cb(p);
  });
}

/**
 * Classify a Button based on its className string.
 * Returns: 'ghost' | 'outline' | 'brand' | 'destructive' | 'secondary' | null (keep default)
 */
function classifyButton(className) {
  if (!className) return 'ghost'; // No className at all = ghost

  const hasBgBrand = /bg-brand-cyan/.test(className);
  const hasBgNeutral = /bg-neutral-\d+/.test(className);
  const hasBgNeutralLow = /bg-neutral-\d+\/\d+/.test(className); // bg-neutral-900/50 etc (semi-transparent)
  const hasBgPrimary = /bg-primary/.test(className);
  const hasBgDestructive = /bg-red-|bg-destructive/.test(className);
  const hasBorder = /\bborder\b/.test(className);
  const hasBgAny = /\bbg-/.test(className);

  // brand-cyan background = brand variant
  if (hasBgBrand) return 'brand';

  // Red/destructive background
  if (hasBgDestructive) return 'destructive';

  // No background class at all = ghost
  if (!hasBgAny) return 'ghost';

  // Semi-transparent neutral bg (bg-neutral-900/50, bg-neutral-800/30, etc) = ghost
  // These are meant to be subtle, not solid
  if (hasBgNeutralLow && !hasBgPrimary) return 'ghost';

  // Solid neutral bg with border = outline style
  if (hasBgNeutral && hasBorder) return 'outline';

  // Solid neutral bg without border = secondary/ghost
  if (hasBgNeutral && !hasBorder) return 'ghost';

  // bg-primary = keep default (null)
  if (hasBgPrimary) return null;

  // Anything else with a bg = keep default
  return null;
}

const stats = { ghost: 0, outline: 0, brand: 0, destructive: 0, secondary: 0, kept: 0, total: 0 };
const modifiedFiles = [];

['src/pages', 'src/components'].forEach(d => walk(d, filePath => {
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;
  let fileChanges = 0;

  // Match <Button with optional variant already set
  // We need to process Button tags that DON'T already have a variant prop
  // Strategy: find each <Button occurrence and check/modify it

  // Split into segments around <Button
  const parts = content.split(/(<Button[\s\r\n])/);
  let result = '';

  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) {
      // Non-Button text
      result += parts[i];
    } else {
      // This is '<Button ' or '<Button\n'
      const buttonStart = parts[i]; // '<Button ' or '<Button\n'
      const rest = parts[i + 1] || '';

      // Check if variant is already set
      // Look ahead in the rest for the closing > of this tag
      const tagEndMatch = rest.match(/^([\s\S]*?)>/);
      if (!tagEndMatch) {
        result += buttonStart;
        continue;
      }

      const tagContent = tagEndMatch[1];

      // Skip if variant already set
      if (/variant\s*=/.test(tagContent)) {
        result += buttonStart;
        stats.kept++;
        stats.total++;
        continue;
      }

      // Extract className value (handle template literals, regular strings)
      let className = '';

      // Try className="..."
      const classMatch = tagContent.match(/className\s*=\s*"([^"]*)"/);
      if (classMatch) {
        className = classMatch[1];
      } else {
        // Try className='...'
        const classSingle = tagContent.match(/className\s*=\s*'([^']*)'/);
        if (classSingle) {
          className = classSingle[1];
        } else {
          // className={`...`} or className={cn(...)} - extract what we can
          const classTmpl = tagContent.match(/className\s*=\s*\{[`"]([^`"]*)[`"]/);
          if (classTmpl) {
            className = classTmpl[1];
          } else {
            // Dynamic className - check surrounding text for bg- patterns
            const classBlock = tagContent.match(/className\s*=\s*\{([\s\S]*?)\}/);
            if (classBlock) {
              className = classBlock[1]; // raw expression, still useful for bg- detection
            }
          }
        }
      }

      const variant = classifyButton(className);
      stats.total++;

      if (variant) {
        // Add variant prop right after <Button
        result += `<Button variant="${variant}" `;
        stats[variant] = (stats[variant] || 0) + 1;
        fileChanges++;
      } else {
        result += buttonStart;
        stats.kept++;
      }
    }
  }

  if (fileChanges > 0) {
    content = result;
    modifiedFiles.push({ file: filePath.replace(/\\/g, '/'), changes: fileChanges });
    if (APPLY) {
      fs.writeFileSync(filePath, content, 'utf8');
    }
  }
}));

console.log(`\n${'='.repeat(60)}`);
console.log(`  Button Variant Classification`);
console.log(`  Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}`);
console.log(`${'='.repeat(60)}\n`);

console.log(`Total Buttons analyzed: ${stats.total}`);
console.log(`  → ghost:       ${stats.ghost}`);
console.log(`  → outline:     ${stats.outline}`);
console.log(`  → brand:       ${stats.brand}`);
console.log(`  → destructive: ${stats.destructive}`);
console.log(`  → kept default:${stats.kept}`);
console.log(`\nFiles ${APPLY ? 'modified' : 'to modify'}: ${modifiedFiles.length}`);

if (modifiedFiles.length > 0) {
  modifiedFiles.sort((a, b) => b.changes - a.changes);
  for (const f of modifiedFiles.slice(0, 30)) {
    console.log(`  ${f.file} (${f.changes} buttons)`);
  }
  if (modifiedFiles.length > 30) {
    console.log(`  ... and ${modifiedFiles.length - 30} more`);
  }
}

if (!APPLY) {
  console.log(`\nRun with --apply to apply changes.`);
}
