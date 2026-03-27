#!/usr/bin/env node

/**
 * Component Usage Analyzer - Node.js Pure Version
 * Fast, reliable component import analysis
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COMPONENTS_DIR = 'src/components';
const SRC_DIR = 'src';
const REPORT_DIR = 'scripts/reports';
const EXCLUDE_PATTERNS = ['index.ts', 'index.tsx', '.test', '.stories'];

if (!fs.existsSync(REPORT_DIR)) {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
}

/**
 * Find all component files
 */
function findComponents() {
  const components = [];

  function walkDir(dir) {
    const files = fs.readdirSync(dir);

    files.forEach(file => {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        walkDir(fullPath);
      } else if (
        (file.endsWith('.tsx') || file.endsWith('.ts')) &&
        !EXCLUDE_PATTERNS.some(p => file.includes(p))
      ) {
        const relativePath = path.relative(COMPONENTS_DIR, fullPath);
        const componentName = path.parse(file).name;

        components.push({
          file: fullPath,
          relativePath: relativePath.replace(/\\/g, '/'),
          name: componentName,
          fullPath: fullPath.replace(/\\/g, '/'),
        });
      }
    });
  }

  walkDir(COMPONENTS_DIR);
  return components;
}

/**
 * Find all TypeScript/React files
 */
function findSourceFiles() {
  const files = [];

  function walk(dir) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      entries.forEach(entry => {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory() && !['node_modules', '.next', 'dist'].includes(entry.name)) {
          walk(fullPath);
        } else if (entry.isFile() && /\.(tsx?|jsx?)$/.test(entry.name)) {
          files.push(fullPath);
        }
      });
    } catch (e) {
      // ignore permission errors
    }
  }

  walk(SRC_DIR);
  return files;
}

/**
 * Count how many files import a component
 */
function countComponentUsage(components, sourceFiles) {
  const usage = new Map();

  // Initialize all components with 0 usage
  components.forEach(comp => {
    usage.set(comp.name, { count: 0, files: [] });
  });

  // Check each source file
  sourceFiles.forEach(file => {
    try {
      const content = fs.readFileSync(file, 'utf-8');
      const skipFile = file.replace(/\\/g, '/');

      components.forEach(comp => {
        // Skip the component's own file
        if (skipFile === comp.fullPath) return;

        // Build search patterns
        const patterns = [
          // @/components/ui/button
          `@/components/${comp.relativePath.replace(/\.[^.]+$/, '')}['"\\?]`,
          // @/components/ui/Button (capitalized)
          `@/components/${comp.relativePath.replace(/\.[^.]+$/, '').charAt(0).toUpperCase() + comp.relativePath.replace(/\.[^.]+$/, '').slice(1)}['"\\?]`,
          // relative imports: ../ui/button
          `['\"]\\.\\.?/?.*${comp.name}['\"]`,
          // ./components/Layout
          `['\"]\\./components/${comp.relativePath.replace(/\.[^.]+$/, '')}['\"]`,
        ];

        // Check if any pattern matches
        const matches = patterns.some(pattern => {
          try {
            const regex = new RegExp(pattern);
            return regex.test(content);
          } catch (e) {
            return false;
          }
        });

        if (matches) {
          const current = usage.get(comp.name);
          if (!current.files.includes(skipFile)) {
            current.files.push(skipFile);
          }
          current.count++;
        }
      });
    } catch (e) {
      // ignore read errors
    }
  });

  return usage;
}

/**
 * Format number with thousands separator
 */
function fmt(n) {
  return n.toString().padStart(3);
}

/**
 * Main
 */
console.log('🔍 Analyzing components...\n');

const components = findComponents();
console.log(`Found ${components.length} components`);

console.log('Scanning source files...');
const sourceFiles = findSourceFiles();
console.log(`Found ${sourceFiles.length} source files\n`);

console.log('Counting usage...');
const usage = countComponentUsage(components, sourceFiles);

// Build analysis
const analysis = components
  .map(comp => ({
    ...comp,
    count: usage.get(comp.name).count,
    files: usage.get(comp.name).files,
  }))
  .sort((a, b) => b.count - a.count);

// Categorize
const categorized = {
  veryFrequent: analysis.filter(c => c.count > 30),
  frequent: analysis.filter(c => c.count > 10 && c.count <= 30),
  moderate: analysis.filter(c => c.count > 2 && c.count <= 10),
  rarely: analysis.filter(c => c.count > 0 && c.count <= 2),
  orphaned: analysis.filter(c => c.count === 0),
};

const total = analysis.reduce((sum, c) => sum + c.count, 0);
const avg = (total / components.length).toFixed(2);

// Generate report
let report = `# Component Usage Analysis

**Generated:** ${new Date().toISOString()}

## 📊 Summary

| Metric | Value |
|--------|-------|
| Total Components | ${components.length} |
| Total Imports | ${total} |
| Average per Component | ${avg} |
| **Orphaned** | ${categorized.orphaned.length} (${((categorized.orphaned.length / components.length) * 100).toFixed(1)}%) |

---

## 🔥 Top 30 Most Used Components

| # | Component | Path | Imports |
|---|-----------|------|---------|
${analysis
    .slice(0, 30)
    .map(
      (c, i) =>
        `| ${fmt(i + 1)} | **${c.name}** | \`${c.relativePath}\` | **${fmt(c.count)}** |`
    )
    .join('\n')}

---

## 📋 By Category

### 🔥 Very Frequent (31+) — ${categorized.veryFrequent.length}
${categorized.veryFrequent.length > 0 ? categorized.veryFrequent.map(c => `- **${c.name}** (${c.count})`).join('\n') : '_None_'}

### 💎 Frequent (11-30) — ${categorized.frequent.length}
${categorized.frequent.length > 0 ? categorized.frequent.map(c => `- **${c.name}** (${c.count})`).join('\n') : '_None_'}

### 🟡 Moderate (3-10) — ${categorized.moderate.length}
${categorized.moderate.length > 0 ? categorized.moderate.slice(0, 20).map(c => `- ${c.name} (${c.count})`).join('\n') + (categorized.moderate.length > 20 ? `\n- _...and ${categorized.moderate.length - 20} more_` : '') : '_None_'}

### ⚠️ Rarely (1-2) — ${categorized.rarely.length}
${categorized.rarely.length > 0 ? categorized.rarely.slice(0, 15).map(c => `- ${c.name} (${c.count})`).join('\n') + (categorized.rarely.length > 15 ? `\n- _...and ${categorized.rarely.length - 15} more_` : '') : '_None_'}

### ❌ Orphaned (0) — ${categorized.orphaned.length}
${categorized.orphaned.length > 0 ? `\`\`\`\n${categorized.orphaned.map(c => c.name).join('\n')}\n\`\`\`` : '_All components are used!_ ✅'}

---

## 💡 Next Steps

${categorized.orphaned.length > 0
    ? `### Delete ${categorized.orphaned.length} orphaned components
\`\`\`bash
# Verify first, then remove
${categorized.orphaned.slice(0, 5).map(c => `rm src/components/${c.relativePath}`).join('\n')}
${categorized.orphaned.length > 5 ? `# ... and ${categorized.orphaned.length - 5} more` : ''}
\`\`\`
`
    : ''
  }

${categorized.rarely.length > 5
    ? `### Consolidate ${categorized.rarely.length} rarely used components
Consider merging these into your main components system.
`
    : ''
  }

`;

// Save report
const mdPath = path.join(REPORT_DIR, 'component-usage.md');
fs.writeFileSync(mdPath, report);

console.log('\n' + report);
console.log(`\n✅ Report saved to: ${mdPath}\n`);

// Summary
console.log('📊 Summary:');
console.log(`  🔥 Very Frequent: ${fmt(categorized.veryFrequent.length)}`);
console.log(`  💎 Frequent:      ${fmt(categorized.frequent.length)}`);
console.log(`  🟡 Moderate:      ${fmt(categorized.moderate.length)}`);
console.log(`  ⚠️ Rarely:        ${fmt(categorized.rarely.length)}`);
console.log(`  ❌ Orphaned:      ${fmt(categorized.orphaned.length)}`);
console.log(`  Total:            ${fmt(components.length)}`);
