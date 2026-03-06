const fs = require('fs');

function checkFile(filename) {
    const content = fs.readFileSync(filename, 'utf-8');
    const lines = content.split('\n');
    const duplicates = [];

    let stack = [];
    let currentKeys = new Set();

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (line.match(/\{\s*$/)) {
            stack.push(currentKeys);
            currentKeys = new Set();
        }

        const keyMatch = line.match(/^\s*"([^"]+)"\s*:/);
        if (keyMatch) {
            const key = keyMatch[1];
            if (currentKeys.has(key)) {
                duplicates.push({ line: i + 1, key });
            } else {
                currentKeys.add(key);
            }
        }

        if (line.match(/^\s*\},?\s*$/)) {
            if (stack.length > 0) {
                currentKeys = stack.pop();
            }
        }
    }

    console.log(`Duplicates in ${filename}:`);
    duplicates.forEach(d => console.log(`  Line ${d.line}: "${d.key}"`));
}

checkFile('src/locales/pt-BR.json');
checkFile('src/locales/en-US.json');
