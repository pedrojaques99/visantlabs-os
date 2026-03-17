const fs = require('fs');
const path = require('path');

// Define the patterns we want to replace
const patterns = {
  microTitle: /text-\[10px\][^"'\`]*tracking-widest|tracking-\[0\.2em\]/g,
  glassPanel: /bg-neutral-900\/[0-9]+.*border-neutral-800/g,
};

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(dirPath);
  });
}

const report = {
  microTitle: [],
  glassPanel: []
};

walkDir('./src', (filePath) => {
  if (!filePath.endsWith('.tsx') && !filePath.endsWith('.ts')) return;
  
  const content = fs.readFileSync(filePath, 'utf8');
  
  if (patterns.microTitle.test(content)) {
    report.microTitle.push(filePath);
  }
  if (patterns.glassPanel.test(content)) {
    report.glassPanel.push(filePath);
  }
});

console.log('\n=== Hardcoded UI Components Audit ===\n');

console.log(`🔍 Encontrados ${report.microTitle.length} arquivos usando MicroTitle hardcoded:`);
report.microTitle.forEach(f => console.log(`  - ${f}`));

console.log(`\n🔍 Encontrados ${report.glassPanel.length} arquivos usando GlassPanel hardcoded:`);
report.glassPanel.forEach(f => console.log(`  - ${f}`));

console.log('\n===================================\n');
console.log('💡 Para corrigir isso automaticamente:');
console.log('1. Podemos usar um script de Codemod (AST/ts-morph) para reescrever as tags.');
console.log('2. Ou o Agente de IA pode atuar iterativamente limpando os arquivos.');
