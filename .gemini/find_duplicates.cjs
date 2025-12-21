const fs = require('fs');
const path = 'z:\\Cursor\\visantlabs-os\\pages\\MockupMachinePage.tsx';

try {
    const content = fs.readFileSync(path, 'utf8');
    const lines = content.split('\n');
    const lineMap = new Map();
    const duplicates = [];

    // Track potential block duplications
    let sequentialDupes = 0;
    let lastDupeIndex = -1;

    lines.forEach((line, index) => {
        const trimmed = line.trim();
        // Ignore short lines, comments, and closing braces/brackets
        // Also ignore common JSX endings or simple returns if they are standard
        // Ignore lines that are strictly just braces or parens
        if (trimmed.length < 20 ||
            trimmed.startsWith('//') ||
            trimmed.startsWith('/*') ||
            trimmed.startsWith('*') ||
            /^[\}\]\)\;]+$/.test(trimmed) ||
            trimmed.startsWith('import ') ||
            trimmed.startsWith('return ') && trimmed.length < 30) {
            return;
        }

        if (lineMap.has(trimmed)) {
            const originalIndex = lineMap.get(trimmed);

            // If the original line is far away (more than 20 lines), it's likely a real duplication issue
            // If it's close, it might be intentional similar logic in switch/case or if/else blocks
            duplicates.push({ line: trimmed, originalIndex: originalIndex + 1, newIndex: index + 1 });
        } else {
            lineMap.set(trimmed, index);
        }
    });

    if (duplicates.length > 0) {
        console.log('Found potential duplicate lines (ignoring imports and short lines):');
        duplicates.forEach(d => {
            console.log(`Line ${d.newIndex} duplicate of ${d.originalIndex}: ${d.line.substring(0, 60)}...`);
        });
    } else {
        console.log('No significant duplicate lines found.');
    }

} catch (e) {
    console.error('Error reading file:', e);
}
