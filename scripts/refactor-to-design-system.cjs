/**
 * refactor-to-design-system.cjs
 *
 * Replaces hardcoded <button>, <input>, <textarea> HTML tags
 * with design system components (Button, Input, Textarea).
 *
 * Usage:
 *   node scripts/refactor-to-design-system.cjs              # dry-run (report only)
 *   node scripts/refactor-to-design-system.cjs --apply       # apply changes
 *   node scripts/refactor-to-design-system.cjs --file src/pages/WelcomeScreen.tsx  # single file
 */

const fs = require('fs');
const path = require('path');

const APPLY = process.argv.includes('--apply');
const SINGLE_FILE = process.argv.includes('--file')
  ? process.argv[process.argv.indexOf('--file') + 1]
  : null;

// Directories to scan
const SCAN_DIRS = ['src/pages', 'src/components'];
// Directories to skip (design system itself)
const SKIP_DIRS = ['src/components/ui'];

// Input types that should NOT be replaced (they need specialized components)
const SKIP_INPUT_TYPES = ['checkbox', 'radio', 'range', 'color', 'hidden'];

// Replacement rules
const REPLACEMENTS = [
  {
    name: 'button → Button',
    // Match <button but NOT inside a string or comment
    openTag: /<button(\s|>)/g,
    openReplace: '<Button$1',
    closeTag: /<\/button>/g,
    closeReplace: '</Button>',
    importName: 'Button',
    importPath: '@/components/ui/button',
  },
  {
    name: 'textarea → Textarea',
    openTag: /<textarea(\s|>)/g,
    openReplace: '<Textarea$1',
    closeTag: /<\/textarea>/g,
    closeReplace: '</Textarea>',
    importName: 'Textarea',
    importPath: '@/components/ui/textarea',
  },
  {
    name: 'input → Input',
    // input is self-closing, but handle both cases
    openTag: null, // handled specially below
    closeTag: /<\/input>/g,
    closeReplace: '</Input>',
    importName: 'Input',
    importPath: '@/components/ui/input',
  },
];

// Stats
const stats = {
  filesScanned: 0,
  filesModified: 0,
  replacements: { button: 0, input: 0, textarea: 0 },
  skippedInputs: [],
  warnings: [],
  modifiedFiles: [],
};

function walkDir(dir, callback) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).forEach(f => {
    const fullPath = path.join(dir, f);
    if (fs.statSync(fullPath).isDirectory()) {
      // Skip excluded directories
      const rel = fullPath.replace(/\\/g, '/');
      if (SKIP_DIRS.some(s => rel.includes(s))) return;
      walkDir(fullPath, callback);
    } else if (fullPath.endsWith('.tsx')) {
      callback(fullPath);
    }
  });
}

function hasImport(content, importName, importPath) {
  // Check various import patterns
  const patterns = [
    // import { Button } from '@/components/ui/button'
    new RegExp(`import\\s*\\{[^}]*\\b${importName}\\b[^}]*\\}\\s*from\\s*['"]${importPath.replace('/', '\\/')}['"]`),
    // import { Button } from "@/components/ui/button"
    new RegExp(`import\\s*\\{[^}]*\\b${importName}\\b[^}]*\\}\\s*from\\s*["']${importPath.replace('/', '\\/')}["']`),
  ];
  return patterns.some(p => p.test(content));
}

function addImport(content, importName, importPath) {
  if (hasImport(content, importName, importPath)) return content;

  // Check if there's already an import from this path (add to existing)
  const existingImportRegex = new RegExp(
    `(import\\s*\\{)([^}]*)(\\}\\s*from\\s*['"]${importPath.replace('/', '\\/')}['"])`,
  );
  const match = content.match(existingImportRegex);
  if (match) {
    // Add to existing import
    const existingNames = match[2].trim();
    const newNames = existingNames.endsWith(',')
      ? `${existingNames} ${importName},`
      : `${existingNames}, ${importName}`;
    return content.replace(existingImportRegex, `$1 ${newNames} $3`);
  }

  // Find the last import line and add after it
  const lines = content.split('\n');
  let lastImportIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].match(/^import\s/)) {
      lastImportIndex = i;
    }
  }

  const importStatement = `import { ${importName} } from '${importPath}'`;
  if (lastImportIndex >= 0) {
    lines.splice(lastImportIndex + 1, 0, importStatement);
  } else {
    lines.unshift(importStatement);
  }
  return lines.join('\n');
}

function shouldSkipInput(lineContent) {
  // Check if this input has a type that should be skipped
  for (const skipType of SKIP_INPUT_TYPES) {
    if (lineContent.includes(`type="${skipType}"`) || lineContent.includes(`type='${skipType}'`)) {
      return skipType;
    }
  }
  return false;
}

function processFile(filePath) {
  stats.filesScanned++;
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;
  const relPath = filePath.replace(/\\/g, '/');
  const fileChanges = { button: 0, input: 0, textarea: 0 };

  // --- Replace <button> → <Button> ---
  const buttonOpenCount = (content.match(/<button(\s|>)/g) || []).length;
  const buttonCloseCount = (content.match(/<\/button>/g) || []).length;
  if (buttonOpenCount > 0) {
    content = content.replace(/<button(\s|>)/g, '<Button$1');
    content = content.replace(/<\/button>/g, '</Button>');
    fileChanges.button = buttonOpenCount;
    stats.replacements.button += buttonOpenCount;
  }

  // --- Replace <textarea> → <Textarea> ---
  const textareaOpenCount = (content.match(/<textarea(\s|>)/g) || []).length;
  if (textareaOpenCount > 0) {
    content = content.replace(/<textarea(\s|>)/g, '<Textarea$1');
    content = content.replace(/<\/textarea>/g, '</Textarea>');
    fileChanges.textarea = textareaOpenCount;
    stats.replacements.textarea += textareaOpenCount;
  }

  // --- Replace <input> → <Input> (with type filtering) ---
  // Process line by line for input to check types
  const lines = content.split('\n');
  let inputCount = 0;
  for (let i = 0; i < lines.length; i++) {
    if ((/<input[\s>\/\r]/i.test(lines[i]) || /^\s*<input\s*$/i.test(lines[i])) && !/<Input[\s>\/\r]/.test(lines[i])) {
      // Check next few lines for type= (JSX often splits across lines)
      const contextLines = lines.slice(i, Math.min(i + 5, lines.length)).join(' ');
      const skipType = shouldSkipInput(contextLines);
      if (skipType) {
        stats.skippedInputs.push({ file: relPath, line: i + 1, type: skipType });
        continue;
      }
      lines[i] = lines[i].replace(/<input(\s|>|\/)/g, '<Input$1');
      lines[i] = lines[i].replace(/^(\s*)<input$/gm, '$1<Input');
      inputCount++;
    }
  }
  if (inputCount > 0) {
    content = lines.join('\n');
    content = content.replace(/<\/input>/g, '</Input>');
    fileChanges.input = inputCount;
    stats.replacements.input += inputCount;
  }

  // --- Add missing imports ---
  if (fileChanges.button > 0) {
    content = addImport(content, 'Button', '@/components/ui/button');
  }
  if (fileChanges.textarea > 0) {
    content = addImport(content, 'Textarea', '@/components/ui/textarea');
  }
  if (fileChanges.input > 0) {
    content = addImport(content, 'Input', '@/components/ui/input');
  }

  // --- Check for warnings ---
  // Buttons with complex event handlers or refs that might need review
  if (fileChanges.button > 5) {
    stats.warnings.push(`${relPath}: ${fileChanges.button} buttons replaced — review variant mapping`);
  }

  if (content !== original) {
    stats.filesModified++;
    const totalChanges = fileChanges.button + fileChanges.input + fileChanges.textarea;
    stats.modifiedFiles.push({
      file: relPath,
      ...fileChanges,
      total: totalChanges,
    });

    if (APPLY) {
      fs.writeFileSync(filePath, content, 'utf8');
    }
  }
}

// ============= MAIN =============
console.log(`\n${'='.repeat(60)}`);
console.log(`  Design System Refactor Script`);
console.log(`  Mode: ${APPLY ? 'APPLY (writing files)' : 'DRY RUN (report only)'}`);
console.log(`${'='.repeat(60)}\n`);

if (SINGLE_FILE) {
  const fullPath = path.resolve(SINGLE_FILE);
  if (fs.existsSync(fullPath)) {
    processFile(fullPath);
  } else {
    console.error(`File not found: ${fullPath}`);
    process.exit(1);
  }
} else {
  for (const dir of SCAN_DIRS) {
    walkDir(dir, processFile);
  }
}

// ============= REPORT =============
console.log(`\n--- SUMMARY ---\n`);
console.log(`Files scanned:  ${stats.filesScanned}`);
console.log(`Files modified: ${stats.filesModified}`);
console.log(`\nReplacements:`);
console.log(`  <button>   → <Button>   : ${stats.replacements.button}`);
console.log(`  <input>    → <Input>    : ${stats.replacements.input}`);
console.log(`  <textarea> → <Textarea> : ${stats.replacements.textarea}`);
console.log(`  Total                    : ${stats.replacements.button + stats.replacements.input + stats.replacements.textarea}`);

if (stats.skippedInputs.length > 0) {
  console.log(`\n--- SKIPPED INPUTS (need specialized components) ---`);
  for (const s of stats.skippedInputs) {
    console.log(`  ${s.file}:${s.line} — type="${s.type}"`);
  }
}

if (stats.warnings.length > 0) {
  console.log(`\n--- WARNINGS (manual review recommended) ---`);
  for (const w of stats.warnings) {
    console.log(`  ${w}`);
  }
}

if (stats.modifiedFiles.length > 0) {
  console.log(`\n--- FILES ${APPLY ? 'MODIFIED' : 'TO BE MODIFIED'} ---`);
  // Sort by total changes descending
  stats.modifiedFiles.sort((a, b) => b.total - a.total);
  for (const f of stats.modifiedFiles) {
    const parts = [];
    if (f.button) parts.push(`${f.button} btn`);
    if (f.input) parts.push(`${f.input} input`);
    if (f.textarea) parts.push(`${f.textarea} textarea`);
    console.log(`  ${f.file} (${parts.join(', ')})`);
  }
}

if (!APPLY) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  This was a DRY RUN. To apply changes, run:`);
  console.log(`  node scripts/refactor-to-design-system.cjs --apply`);
  console.log(`${'='.repeat(60)}\n`);
}
