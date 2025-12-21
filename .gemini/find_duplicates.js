const fs = require('fs');
const path = 'z:\\Cursor\\visantlabs-os\\pages\\MockupMachinePage.tsx';

try {
    const content = fs.readFileSync(path, 'utf8');
    const lines = content.split('\n');
    const lineMap = new Map();
    const duplicates = [];

    lines.forEach((line, index) => {
        const trimmed = line.trim();
        // Ignore short lines, comments, and closing braces
        if (trimmed.length < 15 || trimmed.startsWith('//') || trimmed === '};' || trimmed === '},' || trimmed === '});' || trimmed.startsWith('import ')) {
            return;
        }

        if (lineMap.has(trimmed)) {
            const originalIndex = lineMap.get(trimmed);
            // We only care if it's not the immediate next line (to avoid matching intentional repetition if any, though likely rare for complex lines)
            // Actually, any dupe of complex logic is worth noting.
            duplicates.push({ line: trimmed, originalIndex: originalIndex + 1, newIndex: index + 1 });
        } else {
            lineMap.set(trimmed, index);
        }
    });

    if (duplicates.length > 0) {
        console.log('Found potential duplicate lines (ignoring imports and short lines):');
        duplicates.forEach(d => {
            console.log(`Line ${d.newIndex} is duplicate of ${d.originalIndex}: ${d.line.substring(0, 50)}...`);
        });
    } else {
        console.log('No significant duplicate lines found.');
    }

} catch (e) {
    console.error('Error reading file:', e);
}
