import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, '..');
const SRC_DIR = path.join(ROOT_DIR, 'src');
const LOCALES_DIR = path.join(SRC_DIR, 'locales');

const EXCLUDE_DIRS = ['node_modules', '.git', '.next', 'dist', 'build'];
const UI_ATTRIBUTES = ['placeholder', 'title', 'label', 'description', 'subtitle', 'error', 'success', 'message'];

// Flatten nested JSON object
function flattenObject(obj, prefix = '') {
  return Object.keys(obj).reduce((acc, k) => {
    const pre = prefix.length ? prefix + '.' : '';
    if (typeof obj[k] === 'object' && obj[k] !== null && !Array.isArray(obj[k])) {
      Object.assign(acc, flattenObject(obj[k], pre + k));
    } else {
      acc[pre + k] = obj[k];
    }
    return acc;
  }, {});
}

function walkDir(dir, callback) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      if (!EXCLUDE_DIRS.includes(file)) {
        walkDir(filePath, callback);
      }
    } else {
      callback(filePath);
    }
  }
}

function findHardcodedStrings(content) {
  const matches = [];
  
  // 1. Find text between JSX tags: <div>Text</div>
  // This matches >Text< but ignores tags, braces, and empty space
  const jsxTextRegex = />([^<{}>]+)</g;
  let match;
  while ((match = jsxTextRegex.exec(content)) !== null) {
    const text = match[1].trim();
    if (text && text.length > 1 && !/^[0-9\s\W]+$/.test(text)) {
      matches.push({ text, type: 'JSX Text' });
    }
  }

  // 2. Find UI-related attributes: placeholder="Search"
  for (const attr of UI_ATTRIBUTES) {
    const attrRegex = new RegExp(`${attr}=["']([^"']+)["']`, 'g');
    while ((match = attrRegex.exec(content)) !== null) {
      const text = match[1].trim();
      if (text && !text.startsWith('{') && !text.includes('t(')) {
        matches.push({ text, type: `Attribute: ${attr}` });
      }
    }
  }

  return matches;
}

function runAudit() {
  let output = '🚀 Starting i18n Audit...\n\n';

  // Load existing translations
  let enLocale = {};
  let ptLocale = {};
  try {
    enLocale = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, 'en-US.json'), 'utf8'));
    ptLocale = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, 'pt-BR.json'), 'utf8'));
  } catch (e) {
    output += '⚠️ Could not load locale files from src/locales\n';
  }

  const flattenedEn = flattenObject(enLocale);
  const enValues = new Set(Object.values(flattenedEn));
  const enKeys = Object.keys(flattenedEn);
  const flattenedPt = flattenObject(ptLocale);
  const ptKeys = Object.keys(flattenedPt);

  // 1. Check for missing keys in pt-BR
  const missingInPt = enKeys.filter(key => !ptKeys.includes(key));
  if (missingInPt.length > 0) {
    output += `❌ Found ${missingInPt.length} keys in en-US missing from pt-BR:\n`;
    missingInPt.slice(0, 50).forEach(k => {
      output += `  - ${k}\n`;
    });
    if (missingInPt.length > 50) output += `  ... and ${missingInPt.length - 50} more\n`;
    output += '\n';
  } else {
    output += '✅ All keys in en-US are present in pt-BR.\n\n';
  }

  // 2. Scan for hardcoded strings in source
  output += '🔍 Scanning source files for hardcoded strings...\n\n';
  const hardcodedReport = [];
  
  walkDir(SRC_DIR, (filePath) => {
    if (!filePath.endsWith('.tsx') && !filePath.endsWith('.ts')) return;
    if (filePath.includes('locales')) return;
    if (filePath.includes('node_modules')) return;

    const content = fs.readFileSync(filePath, 'utf8');
    const strings = findHardcodedStrings(content);
    
    // Filter out strings that are already translated (exact match)
    const missingStrings = strings.filter(s => !enValues.has(s.text));

    if (missingStrings.length > 0) {
      hardcodedReport.push({
        file: path.relative(ROOT_DIR, filePath),
        strings: missingStrings
      });
    }
  });

  if (hardcodedReport.length > 0) {
    output += `❌ Found hardcoded strings in ${hardcodedReport.length} files:\n`;
    hardcodedReport.forEach(report => {
      output += `\n📄 ${report.file}:\n`;
      report.strings.forEach(s => {
        output += `  - [${s.type}] "${s.text}"\n`;
      });
    });
  } else {
    output += '✅ No obvious hardcoded strings found in source code.\n';
  }

  output += '\n====================================\n';
  output += 'Audit complete.\n';

  fs.writeFileSync(path.join(ROOT_DIR, 'i18n-report.txt'), output);
  console.log(output);
}

runAudit();
