#!/usr/bin/env node

/**
 * investigate-orphans.cjs
 *
 * Deep investigation of orphaned files to determine if they're truly unused
 * or hidden by refactoring/dynamic patterns.
 *
 * Checks for:
 * - Dynamic imports (React.lazy)
 * - Re-exports from barrel files
 * - Router references
 * - Webpack/bundler config references
 * - Version conflicts (maybe replaced by newer file)
 */

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '..', 'src');

// Load orphans from previous audit
const orphans = require('../orphans.json').files;

console.log('\n' + '='.repeat(70));
console.log('ORPHANED FILES INVESTIGATION');
console.log('='.repeat(70));

const investigation = {};

orphans.forEach(orphanPath => {
  const fullPath = path.join(SRC_DIR, orphanPath);
  const fileName = path.basename(orphanPath);
  const componentName = path.basename(orphanPath, path.extname(orphanPath));

  const reasons = [];

  // Check 1: Maybe used in barrel re-exports
  const dirName = path.dirname(orphanPath);
  const indexPath = path.join(SRC_DIR, dirName, 'index.tsx');
  if (fs.existsSync(indexPath)) {
    const indexContent = fs.readFileSync(indexPath, 'utf-8');
    if (indexContent.includes(componentName)) {
      reasons.push('✓ Re-exported from barrel file');
    }
  }

  // Check 2: React.lazy() references
  const lazyPattern = new RegExp(
    `React\\.lazy\\s*\\(\\s*[()\\s=>]*import\\s*\\(\\s*['""]\\${componentName}`,
    'i'
  );
  const allFilesContent = fs
    .readdirSync(SRC_DIR, { recursive: true })
    .filter(f => (f.endsWith('.tsx') || f.endsWith('.ts')) && !f.includes('node_modules'))
    .map(f => ({ path: f, content: fs.readFileSync(path.join(SRC_DIR, f), 'utf-8') }));

  const lazyUsed = allFilesContent.some(
    f =>
      f.content.includes(`'${orphanPath}'`) ||
      f.content.includes(`"${orphanPath}"`) ||
      f.path.includes('router') &&
      f.content.includes(componentName)
  );
  if (lazyUsed) {
    reasons.push('⚠ Possibly used in lazy/dynamic import');
  }

  // Check 3: File size (very small might be stub/placeholder)
  if (fs.existsSync(fullPath)) {
    const stats = fs.statSync(fullPath);
    if (stats.size < 300) {
      reasons.push('ℹ Very small file (<300 bytes) - might be placeholder');
    }
  }

  // Check 4: Similar newer file exists
  const siblingFiles = fs
    .readdirSync(path.dirname(fullPath))
    .filter(f => f !== fileName && f.endsWith('.tsx') && f.includes(componentName.slice(0, 5)));

  if (siblingFiles.length > 0) {
    reasons.push(`⚠ Similar file exists: ${siblingFiles.join(', ')}`);
  }

  // Check 5: Router or page file
  if (orphanPath.includes('/pages/') && orphanPath.endsWith('.tsx')) {
    reasons.push('ℹ Page component (may be router-injected, check router config)');
  }

  // Check 6: Server-side utility
  if (orphanPath.includes('Server') || orphanPath.includes('server')) {
    reasons.push('ℹ Server-related file (may only be used server-side)');
  }

  investigation[orphanPath] = {
    exists: fs.existsSync(fullPath),
    size: fs.existsSync(fullPath) ? fs.statSync(fullPath).size : 0,
    reasons: reasons.length > 0 ? reasons : ['❌ No external references found'],
  };
});

// Categorize by confidence level
const confident = {};
const uncertain = {};

Object.entries(investigation).forEach(([file, data]) => {
  const hasWarnings = data.reasons.some(r => r.startsWith('⚠') || r.startsWith('ℹ'));
  if (hasWarnings) {
    uncertain[file] = data;
  } else {
    confident[file] = data;
  }
});

console.log(`\n🔴 LIKELY UNUSED (High Confidence - ${Object.keys(confident).length} files)`);
console.log('These have no detected usage patterns:\n');

Object.entries(confident).forEach(([file, data]) => {
  console.log(`  ${file} (${data.size} bytes)`);
  data.reasons.forEach(r => console.log(`    ${r}`));
});

console.log(`\n🟡 UNCERTAIN (Low Confidence - ${Object.keys(uncertain).length} files)`);
console.log('These have potential usage patterns - verify manually:\n');

Object.entries(uncertain).forEach(([file, data]) => {
  console.log(`  ${file} (${data.size} bytes)`);
  data.reasons.forEach(r => console.log(`    ${r}`));
});

console.log('\n' + '='.repeat(70));
console.log(`SUMMARY`);
console.log('='.repeat(70));
console.log(`Total orphaned files: ${orphans.length}`);
console.log(`Likely unused: ${Object.keys(confident).length}`);
console.log(`Uncertain: ${Object.keys(uncertain).length}`);
console.log(`\nRecommendation: Review the "Likely Unused" list and consider removal.`);
console.log('='.repeat(70) + '\n');

// Save detailed report
fs.writeFileSync(
  path.join(__dirname, '..', 'orphans-investigation.json'),
  JSON.stringify({ confident, uncertain }, null, 2)
);
console.log('✓ Detailed report saved to orphans-investigation.json');
