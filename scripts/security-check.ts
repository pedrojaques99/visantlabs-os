
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Patterns to search for
const patterns = [
    { name: 'Dangerous Eval', regex: /eval\(/, severity: 'HIGH' },
    { name: 'Dangerously Set Inner HTML', regex: /dangerouslySetInnerHTML/, severity: 'MEDIUM' },
    { name: 'Hardcoded Secret', regex: /(api_key|secret_key|password)\s*[:=]\s*['"][^'"]+['"]/, severity: 'HIGH' },
    { name: 'Console Log in Production', regex: /console\.log\(/, severity: 'LOW' },
    { name: 'TODO Comment', regex: /TODO:/, severity: 'INFO' },
    { name: 'No Auth Middleware in Route', regex: /router\.(get|post|put|delete|patch)\s*\(\s*['"][^'"]+['"]\s*,\s*(?!(authMiddleware|verifyToken|ensureAuthenticated))/, severity: 'MEDIUM' }, // Crude check
];

const excludeDirs = ['node_modules', 'dist', '.git', '.gemini', 'scripts'];
const extensions = ['.ts', '.tsx', '.js', '.jsx'];

let issuesFound = 0;

function scanFile(filePath: string) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    lines.forEach((line, index) => {
        patterns.forEach((pattern) => {
            // Skip "No Auth Middleware" check for non-route files roughly
            if (pattern.name === 'No Auth Middleware in Route' && !filePath.includes('routes')) return;

            if (pattern.regex.test(line)) {
                console.log(`[${pattern.severity}] ${pattern.name} found in ${path.relative(rootDir, filePath)}:${index + 1}`);
                console.log(`   Line: ${line.trim().substring(0, 100)}...`);
                issuesFound++;
            }
        });
    });
}

function walkDir(dir: string) {
    const files = fs.readdirSync(dir);

    files.forEach((file) => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            if (!excludeDirs.includes(file)) {
                walkDir(filePath);
            }
        } else {
            if (extensions.includes(path.extname(file))) {
                scanFile(filePath);
            }
        }
    });
}

console.log('🔒 Starting Security Scan...');
walkDir(rootDir);
console.log(`\nScan complete. Found ${issuesFound} potential issues.`);
