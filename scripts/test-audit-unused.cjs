#!/usr/bin/env node

/**
 * test-audit-unused.cjs
 *
 * Quick proof-of-concept for the three-engine audit system.
 * Demonstrates approach on real codebase without making changes.
 *
 * Usage:
 *   node scripts/test-audit-unused.cjs
 */

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '..', 'src');

// ============================================================================
// UTILITY: AST-lite parsing (regex-based for speed)
// ============================================================================

function parseExports(fileContent, filePath) {
  const exports = [];

  // Match: export function name() | export const name = | export default
  const patterns = [
    /export\s+(?:function|const|let|type|interface|class)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g,
    /export\s+\{([^}]+)\}/g,
    /export\s+default/g,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(fileContent)) !== null) {
      if (match[1]) {
        match[1].split(',').forEach(name => {
          const cleanName = name.trim().split(' as ')[0].trim();
          if (cleanName) exports.push(cleanName);
        });
      } else if (pattern.source.includes('default')) {
        exports.push('default');
      }
    }
  }

  return [...new Set(exports)]; // dedupe
}

function parseImports(fileContent) {
  const imports = new Set();

  // Pattern 1: Regular imports
  // Match: import { X, Y } from 'module' | import X from 'module'
  const pattern1 = /import\s+(?:\{([^}]+)\}|(?:(\w+)(?:\s*,\s*\{([^}]+)\})?))\s+from\s+['"]([^'"]+)['"]/g;

  let match;
  while ((match = pattern1.exec(fileContent)) !== null) {
    const namedImports = match[1] || match[3];
    if (namedImports) {
      namedImports.split(',').forEach(name => {
        imports.add(name.trim().split(' as ')[0].trim());
      });
    }
    if (match[2]) imports.add(match[2]);
  }

  // Pattern 2: Type imports (import type { X, Y } from 'module')
  const pattern2 = /import\s+type\s+(?:\{([^}]+)\}|(\w+))\s+from\s+['"]([^'"]+)['"]/g;

  while ((match = pattern2.exec(fileContent)) !== null) {
    const namedImports = match[1];
    if (namedImports) {
      namedImports.split(',').forEach(name => {
        imports.add(name.trim().split(' as ')[0].trim());
      });
    }
    if (match[2]) imports.add(match[2]);
  }

  // Pattern 3: Mixed imports (import X, { Y, Z as A } type from 'module')
  const pattern3 = /import\s+(?:(\w+)\s*,)?\s*\{\s*type\s+([^}]+)\s*\}\s+from\s+['"]([^'"]+)['"]/g;

  while ((match = pattern3.exec(fileContent)) !== null) {
    if (match[1]) imports.add(match[1]);
    if (match[2]) {
      match[2].split(',').forEach(name => {
        imports.add(name.trim().split(' as ')[0].trim());
      });
    }
  }

  return Array.from(imports);
}

// ============================================================================
// ENGINE 1: Unused Exports
// ============================================================================

console.log('\n' + '='.repeat(70));
console.log('ENGINE 1: Scanning for unused exports...');
console.log('='.repeat(70));

const allFiles = [];
const allExports = {};
const allImports = new Set();

function walkDir(dir) {
  fs.readdirSync(dir).forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      if (!file.startsWith('.') && file !== 'node_modules') {
        walkDir(fullPath);
      }
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      if (!file.endsWith('.test.ts') && !file.endsWith('.spec.ts')) {
        allFiles.push(fullPath);
        const content = fs.readFileSync(fullPath, 'utf-8');
        const exports = parseExports(content, fullPath);
        const imports = parseImports(content);

        if (exports.length > 0) {
          const relPath = path.relative(SRC_DIR, fullPath);
          allExports[relPath] = exports;
        }

        imports.forEach(imp => allImports.add(imp));
      }
    }
  });
}

walkDir(SRC_DIR);

let unusedExportCount = 0;
for (const [filePath, exports] of Object.entries(allExports)) {
  const unused = exports.filter(exp => !allImports.has(exp));
  if (unused.length > 0) {
    console.log(`\n📄 ${filePath}`);
    unused.forEach(exp => {
      console.log(`   └─ ${exp}`);
      unusedExportCount++;
    });
  }
}

console.log(`\n✓ Found ${unusedExportCount} unused exports`);

// ============================================================================
// ENGINE 2: Unused Files
// ============================================================================

console.log('\n' + '='.repeat(70));
console.log('ENGINE 2: Scanning for unused files...');
console.log('='.repeat(70));

const entryPoints = new Set([
  'main.tsx', 'index.tsx', 'App.tsx', 'index.ts',
  'WelcomeScreen.tsx', 'AuthCallbackPage.tsx',
  'vite-env.d.ts', 'liveblocks.config.ts'
]);

// Files/patterns to exclude (likely used but not detected)
const excludePatterns = [
  /\/pages\/.+\.tsx$/, // All pages (router-imported)
  /\/hooks\/.+\.ts$/, // All hooks (imported dynamically or barrel-exported)
  /\/services\/.+\.ts$/, // All services (similar pattern)
  /\/types\/.+\.ts$/, // Type definitions
  /\.d\.ts$/, // Declaration files
];

function shouldExclude(relPath) {
  return excludePatterns.some(pattern => pattern.test(relPath));
}

const importedFiles = new Set();

function resolveImport(modulePath, fromFile) {
  let resolved = null;

  // Handle alias: @/ → ./src/
  if (modulePath.startsWith('@/')) {
    const withoutAlias = modulePath.slice(2); // remove '@/'
    resolved = path.join(SRC_DIR, withoutAlias);
  }
  // Handle relative imports
  else if (modulePath.startsWith('.')) {
    const baseDir = path.dirname(fromFile);
    resolved = path.normalize(path.join(baseDir, modulePath));
  }
  // Ignore node_modules and other absolute paths
  else {
    return null;
  }

  // Try different extensions
  for (const ext of ['.tsx', '.ts', '/index.tsx', '/index.ts', '']) {
    const candidate = ext ? resolved + ext : resolved;
    if (fs.existsSync(candidate)) {
      let relPath = path.relative(SRC_DIR, candidate).replace(/\\/g, '/');
      // Normalize to handle directory imports
      if (fs.statSync(candidate).isDirectory()) {
        relPath = relPath + '/index.tsx';
      }
      return relPath;
    }
  }
  return null;
}

allFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf-8');

  // Pattern 1: Regular imports
  const pattern1 = /from\s+['"]([^'"]+)['"]/g;

  // Pattern 2: Dynamic imports (import('...'))
  const pattern2 = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

  // Pattern 3: Require calls
  const pattern3 = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

  for (const pattern of [pattern1, pattern2, pattern3]) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const modulePath = match[1];
      const resolved = resolveImport(modulePath, file);
      if (resolved) {
        importedFiles.add(resolved);
      }
    }
  }
});

const orphans = [];
allFiles.forEach(file => {
  const relPath = path.relative(SRC_DIR, file).replace(/\\/g, '/');
  const fileName = path.basename(file);

  if (!entryPoints.has(fileName) && !importedFiles.has(relPath) && !shouldExclude(relPath)) {
    orphans.push(relPath);
  }
});

// Group by directory for analysis
const orphansByDir = {};
orphans.forEach(file => {
  const dir = file.split('/')[0];
  if (!orphansByDir[dir]) orphansByDir[dir] = [];
  orphansByDir[dir].push(file);
});

console.log(`\nOrphaned Files by Directory:`);
Object.entries(orphansByDir)
  .sort(([, a], [, b]) => b.length - a.length)
  .forEach(([dir, files]) => {
    console.log(`\n  ${dir}/ (${files.length} files)`);
    files.slice(0, 5).forEach(f => console.log(`    └─ ${f}`));
    if (files.length > 5) console.log(`    ... and ${files.length - 5} more`);
  });

console.log(`\n✓ Found ${orphans.length} orphaned files (see orphans.json for full list)`);

// Save full list for analysis
fs.writeFileSync(
  path.join(__dirname, '..', 'orphans.json'),
  JSON.stringify({ count: orphans.length, files: orphans, byDirectory: orphansByDir }, null, 2)
);

// ============================================================================
// ENGINE 3: Unused Design System Components
// ============================================================================

console.log('\n' + '='.repeat(70));
console.log('ENGINE 3: Scanning design system (src/components/ui/)...');
console.log('='.repeat(70));

const uiDir = path.join(SRC_DIR, 'components', 'ui');
if (fs.existsSync(uiDir)) {
  const dsExports = [];

  fs.readdirSync(uiDir).forEach(file => {
    if ((file.endsWith('.tsx') || file.endsWith('.ts')) && file !== 'index.tsx') {
      const fullPath = path.join(uiDir, file);
      const content = fs.readFileSync(fullPath, 'utf-8');
      const exports = parseExports(content, fullPath);

      exports.forEach(exp => {
        if (exp !== 'default') {
          dsExports.push({ name: exp, file });
        }
      });
    }
  });

  console.log(`\nDesign System Components Found: ${dsExports.length}`);

  const unusedDS = dsExports.filter(comp => !allImports.has(comp.name));

  if (unusedDS.length > 0) {
    console.log(`\nUnused Design System Components (${unusedDS.length}):`);
    unusedDS.forEach(comp => {
      console.log(`   └─ ${comp.name} (from ${comp.file})`);
    });
  } else {
    console.log('\n✓ All design system components are imported');
  }
} else {
  console.log('   (src/components/ui/ not found)');
}

// ============================================================================
// SUMMARY
// ============================================================================

console.log('\n' + '='.repeat(70));
console.log('SUMMARY');
console.log('='.repeat(70));
console.log(`Total files scanned: ${allFiles.length}`);
console.log(`Unused exports: ${unusedExportCount}`);
console.log(`Orphaned files: ${orphans.length}`);
console.log(`\n✓ DRY RUN - No changes made`);
console.log('='.repeat(70) + '\n');
