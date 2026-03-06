import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const srcDir = path.join(__dirname, 'src');

const replacements = [
    { search: /'gemini-2\.5-flash-image'/g, replace: 'GEMINI_MODELS.FLASH' },
    { search: /"gemini-2\.5-flash-image"/g, replace: 'GEMINI_MODELS.FLASH' },
    { search: /'gemini-3\.1-flash-image-preview'/g, replace: 'GEMINI_MODELS.NB2' },
    { search: /"gemini-3\.1-flash-image-preview"/g, replace: 'GEMINI_MODELS.NB2' },
    { search: /'gemini-3-pro-image-preview'/g, replace: 'GEMINI_MODELS.PRO' },
    { search: /"gemini-3-pro-image-preview"/g, replace: 'GEMINI_MODELS.PRO' },
    { search: /'gemini-2\.5-flash'/g, replace: 'GEMINI_MODELS.TEXT' },
    { search: /"gemini-2\.5-flash"/g, replace: 'GEMINI_MODELS.TEXT' },
];

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else {
            if (file.endsWith('.ts') || file.endsWith('.tsx')) {
                results.push(file);
            }
        }
    });
    return results;
}

const files = walk(srcDir);
let modifiedCount = 0;

files.forEach(file => {
    if (file.includes('geminiModels.ts') || file.includes('types.ts') || file.includes('ChatInput.tsx') || file.includes('OutputConfigSection.tsx')) return;

    let content = fs.readFileSync(file, 'utf8');
    let originalContent = content;

    replacements.forEach(({ search, replace }) => {
        content = content.replace(search, replace);
    });

    if (content !== originalContent) {
        if (!originalContent.includes('GEMINI_MODELS') && content.includes('GEMINI_MODELS')) {
            const importStatement = `import { GEMINI_MODELS } from '@/constants/geminiModels';\n`;

            const lines = content.split('\n');
            let lastImportIdx = -1;
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].trim().startsWith('import ')) {
                    lastImportIdx = i;
                }
            }

            if (lastImportIdx !== -1) {
                lines.splice(lastImportIdx + 1, 0, importStatement);
            } else {
                lines.unshift(importStatement);
            }
            content = lines.join('\n');
        }

        fs.writeFileSync(file, content, 'utf8');
        modifiedCount++;
        console.log(`Updated ${file}`);
    }
});

console.log(`Done. Modified ${modifiedCount} files.`);
