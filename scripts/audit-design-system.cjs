/**
 * audit-design-system.cjs
 *
 * Comprehensive audit of hardcoded UI patterns that should use design system components.
 * Run regularly to maintain consistency. Can be used as a CI check.
 *
 * Usage:
 *   node scripts/audit-design-system.cjs                # full report
 *   node scripts/audit-design-system.cjs --ci           # exit code 1 if issues found
 *   node scripts/audit-design-system.cjs --json         # JSON output for tooling
 */
const fs = require('fs');
const path = require('path');

const CI_MODE = process.argv.includes('--ci');
const JSON_MODE = process.argv.includes('--json');

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
    } else if (p.endsWith('.tsx') || p.endsWith('.ts')) {
      cb(p);
    }
  });
}

// ── RULES ──────────────────────────────────────────────────
// Each rule detects a hardcoded pattern and suggests the DS component.
const rules = [
  {
    id: 'raw-button',
    name: '<button> → Button',
    severity: 'error',
    component: 'Button from @/components/ui/button',
    test: (line) => /<button[\s>\/]/i.test(line) && !/<Button[\s>\/]/.test(line),
  },
  {
    id: 'raw-input',
    name: '<input> → Input',
    severity: 'error',
    component: 'Input from @/components/ui/input',
    test: (line, ctx) => {
      if (!/<input[\s>\/]/i.test(line)) return false;
      if (/<Input[\s>\/]/.test(line)) return false;
      // Skip specialized types
      const context = ctx || line;
      if (/type=["'](checkbox|radio|range|color|hidden)["']/.test(context)) return false;
      return true;
    },
  },
  {
    id: 'raw-textarea',
    name: '<textarea> → Textarea',
    severity: 'error',
    component: 'Textarea from @/components/ui/textarea',
    test: (line) => /<textarea[\s>]/i.test(line) && !/<Textarea[\s>]/.test(line),
  },
  {
    id: 'raw-select',
    name: '<select> → Select',
    severity: 'error',
    component: 'Select from @/components/ui/select',
    test: (line) => /<select[\s>]/i.test(line) && !/<Select[\s>]/.test(line),
  },
  {
    id: 'hardcoded-microtitle',
    name: 'Hardcoded MicroTitle pattern → MicroTitle',
    severity: 'warn',
    component: 'MicroTitle from @/components/ui/MicroTitle',
    test: (line) => {
      // Detect text-[10px] tracking-widest or tracking-[0.2em] patterns
      if (/MicroTitle/.test(line)) return false; // already using it
      return /text-\[10px\].*tracking|tracking-\[0\.2em\]/.test(line);
    },
  },
  {
    id: 'hardcoded-modal-overlay',
    name: 'Hardcoded modal overlay → Modal component',
    severity: 'warn',
    component: 'Modal from @/components/ui/Modal',
    test: (line) => {
      return /fixed\s+inset-0.*z-50/.test(line) || /fixed\s+inset-0.*z-\[9999\]/.test(line);
    },
    // Only flag in non-Modal files
    fileFilter: (filePath) => !filePath.includes('Modal.tsx') && !filePath.includes('modal.tsx')
      && !filePath.includes('sheet.tsx') && !filePath.includes('CommandPalette')
      && !filePath.includes('FullScreenViewer') && !filePath.includes('Overlay'),
  },
  {
    id: 'button-missing-variant',
    name: 'Button without variant prop',
    severity: 'info',
    component: 'Add variant="ghost|outline|brand" to Button',
    test: (line) => {
      if (!/<Button[\s\r\n]/.test(line)) return false;
      if (/variant\s*=/.test(line)) return false;
      // Single-line self-closing Button without variant
      return /<Button\s[^>]*>/.test(line) && !/variant/.test(line);
    },
  },
  {
    id: 'duplicate-import',
    name: 'Duplicate component import',
    severity: 'error',
    component: 'Remove duplicate import',
    // This is checked at file level, not line level
    test: () => false,
    fileTest: (content) => {
      const importLines = content.split('\n').filter(l => /^import\s*\{/.test(l.trim()));
      const names = {};
      const dupes = [];
      for (const line of importLines) {
        const match = line.match(/import\s*\{\s*(\w+)\s*\}\s*from/);
        if (match) {
          const name = match[1];
          if (names[name]) dupes.push(name);
          else names[name] = true;
        }
      }
      return dupes.length > 0 ? dupes : null;
    },
  },
];

// ── SCAN ───────────────────────────────────────────────────
const results = { errors: 0, warnings: 0, info: 0, files: {} };

SCAN_DIRS.forEach(dir => walk(dir, filePath => {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const rel = filePath.replace(/\\/g, '/');
  const fileIssues = [];

  // Line-level rules
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const context = lines.slice(i, Math.min(i + 5, lines.length)).join(' ');

    for (const rule of rules) {
      if (rule.fileFilter && !rule.fileFilter(rel)) continue;
      if (rule.test(line, context)) {
        fileIssues.push({
          rule: rule.id,
          name: rule.name,
          severity: rule.severity,
          line: i + 1,
          component: rule.component,
          snippet: line.trim().substring(0, 100),
        });
      }
    }
  }

  // File-level rules
  for (const rule of rules) {
    if (rule.fileTest) {
      const result = rule.fileTest(content);
      if (result) {
        fileIssues.push({
          rule: rule.id,
          name: rule.name,
          severity: rule.severity,
          line: 0,
          component: rule.component,
          snippet: `Duplicate imports: ${result.join(', ')}`,
        });
      }
    }
  }

  if (fileIssues.length > 0) {
    results.files[rel] = fileIssues;
    for (const issue of fileIssues) {
      if (issue.severity === 'error') results.errors++;
      else if (issue.severity === 'warn') results.warnings++;
      else results.info++;
    }
  }
}));

// ── OUTPUT ─────────────────────────────────────────────────
if (JSON_MODE) {
  console.log(JSON.stringify(results, null, 2));
} else {
  const totalIssues = results.errors + results.warnings + results.info;
  const fileCount = Object.keys(results.files).length;

  console.log(`\n${'='.repeat(60)}`);
  console.log('  Design System Compliance Audit');
  console.log(`${'='.repeat(60)}\n`);

  if (totalIssues === 0) {
    console.log('  All clear! No hardcoded UI patterns found.\n');
  } else {
    // Group by rule
    const byRule = {};
    for (const [file, issues] of Object.entries(results.files)) {
      for (const issue of issues) {
        if (!byRule[issue.rule]) byRule[issue.rule] = { ...issue, files: [], count: 0 };
        byRule[issue.rule].files.push({ file, line: issue.line, snippet: issue.snippet });
        byRule[issue.rule].count++;
      }
    }

    for (const [ruleId, data] of Object.entries(byRule)) {
      const icon = data.severity === 'error' ? 'ERR' : data.severity === 'warn' ? 'WARN' : 'INFO';
      console.log(`[${icon}] ${data.name} (${data.count} occurrences)`);
      console.log(`       Fix: Use ${data.component}`);
      // Show top 5 files
      const topFiles = data.files.slice(0, 5);
      for (const f of topFiles) {
        const loc = f.line ? `:${f.line}` : '';
        console.log(`       - ${f.file}${loc}`);
      }
      if (data.files.length > 5) {
        console.log(`       ... and ${data.files.length - 5} more`);
      }
      console.log();
    }

    console.log(`${'─'.repeat(60)}`);
    console.log(`  Total: ${totalIssues} issues in ${fileCount} files`);
    console.log(`  Errors: ${results.errors} | Warnings: ${results.warnings} | Info: ${results.info}`);
    console.log(`${'─'.repeat(60)}\n`);
  }
}

if (CI_MODE && results.errors > 0) {
  process.exit(1);
}
