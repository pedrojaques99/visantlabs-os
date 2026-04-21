import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT_DIR, 'src');

/**
 * Regex patterns for detection
 */
const PATTERNS = {
  stars: /[⭐✨🌟]|Star|Sparkles/g,
  winds: /[🌬️💨]|Wind/g,
  icons: /import.*from ['"]lucide-react['"]|Icon|Lucide/g,
  emojis: /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}]/gu
};

/**
 * Replacement maps
 */
const REPLACEMENTS = [
  // Emojis
  { from: /[⭐✨🪄]/g, to: '💎' },
  // Lucide Icons (as components <Star /> or names)
  { from: /\b(Star|Sparkles|Wand2|Wand|MagicWand|Stars)\b/g, to: 'Diamond' }
];

const IGNORE_DIRS = ['node_modules', '.git', 'dist', 'build', '.next'];
const EXTENSIONS = ['.tsx', '.ts', '.js', '.jsx', '.css', '.json'];

function scanDirectory(dir, results = []) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      if (!IGNORE_DIRS.includes(file)) {
        scanDirectory(fullPath, results);
      }
    } else if (EXTENSIONS.includes(path.extname(file))) {
      results.push(fullPath);
    }
  }
  
  return results;
}

function auditFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const fileResults = {
    file: path.relative(ROOT_DIR, filePath),
    stars: [],
    winds: [],
    icons: [],
    emojis: []
  };
  
  for (const [key, regex] of Object.entries(PATTERNS)) {
    const matches = content.match(regex);
    if (matches) {
      fileResults[key] = [...new Set(matches)];
    }
  }
  
  const hasMatches = Object.values(fileResults).some(val => Array.isArray(val) && val.length > 0 && val !== fileResults.file);
  return hasMatches ? fileResults : null;
}

function transformFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;
  let originalContent = content;

  for (const r of REPLACEMENTS) {
    if (r.from.test(content)) {
      content = content.replace(r.from, r.to);
      changed = true;
    }
  }

  if (changed) {
    // If we replaced Lucide icons, ensure 'Diamond' is imported if it was lucide icons we replaced
    // This is a simple heuristic: if content has 'Diamond' but doesn't have it in lucide-react import, we might need to fix it.
    // However, the regex above replaces 'Star' with 'Diamond' even in imports.
    // Let's refine the import logic: if Diamond was added, we should make sure those imports are unique.
    
    // De-duplicate items in lucide-react imports if any
    const lucideImportRegex = /import\s+\{([^}]+)\}\s+from\s+['"]lucide-react['"]/g;
    content = content.replace(lucideImportRegex, (match, p1) => {
      const parts = p1.split(',').map(s => s.trim());
      const uniqueParts = [...new Set(parts)];
      return `import { ${uniqueParts.join(', ')} } from 'lucide-react'`;
    });

    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf8');
      return true;
    }
  }
  return false;
}

async function run() {
  const args = process.argv.slice(2);
  const isReplaceMode = args.includes('--replace') || args.includes('--fix');

  if (isReplaceMode) {
    console.log('\x1b[35m%s\x1b[0m', '💎 Running Replacement Tool (Star/Wand -> Diamond)...');
  } else {
    console.log('\x1b[36m%s\x1b[0m', '🔍 Starting Visual Audit (Stars, Winds, Icons, Emojis)...');
  }
  
  const allFiles = scanDirectory(SRC_DIR);
  const auditResults = [];
  let filesChanged = 0;
  
  let totalStars = 0;
  let totalWinds = 0;
  let totalIcons = 0;
  let totalEmojis = 0;

  for (const file of allFiles) {
    if (isReplaceMode) {
      if (transformFile(file)) {
        filesChanged++;
      }
    }

    const report = auditFile(file);
    if (report) {
      auditResults.push(report);
      totalStars += report.stars.length;
      totalWinds += report.winds.length;
      totalIcons += report.icons.length;
      totalEmojis += report.emojis.length;
    }
  }

  if (isReplaceMode) {
    console.log('\n\x1b[32m%s\x1b[0m', '✨ Replacement Complete!');
    console.log(`Files modified: ${filesChanged}`);
  } else {
    console.log('\n\x1b[32m%s\x1b[0m', '✅ Audit Complete!');
  }

  console.log('---------------------------------');
  console.log(`✨ Stars Detected: ${totalStars}`);
  console.log(`🌬️ Winds Detected: ${totalWinds}`);
  console.log(`📦 Icons Detected: ${totalIcons}`);
  console.log(`😊 Emojis Detected: ${totalEmojis}`);
  console.log('---------------------------------');

  // Save detailed report
  const distDir = path.join(ROOT_DIR, 'dist');
  if (!fs.existsSync(distDir)) fs.mkdirSync(distDir);
  
  const reportPath = path.join(distDir, 'visual-audit.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    metadata: {
      generatedAt: new Date().toISOString(),
      mode: isReplaceMode ? 'replace' : 'audit',
      totals: { stars: totalStars, winds: totalWinds, icons: totalIcons, emojis: totalEmojis }
    },
    results: auditResults
  }, null, 2));

  console.log(`\x1b[35mReport updated: ${path.relative(ROOT_DIR, reportPath)}\x1b[0m\n`);
}

run().catch(err => {
  console.error('❌ Error during visual audit:', err);
  process.exit(1);
});
