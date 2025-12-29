const fs = require('fs');
const path = require('path');

function parseAndMerge(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split(/\r?\n/);

    let currentKey = null;
    let buffer = [];
    const keyMap = new Map(); // key -> [objects]

    // Helper to process buffer
    const processBuffer = () => {
        if (!currentKey || buffer.length === 0) return;

        let block = buffer.join('\n').trim();

        // Remove trailing comma if present
        if (block.endsWith(',')) {
            block = block.slice(0, -1);
        }

        // If block accidentally includes the closing file brace, remove it
        if (block.endsWith('}')) {
            // CAREFUL: This might be the closing brace of the object itself!
            // We need to distinguish between the object's closing brace and the FILE'S closing brace.
            // The file's closing brace should have been filtered out by the line loop if we logic correctly.
            // But let's rely on JSON.parse error to catch malformed stuff.
        }

        try {
            const wrapped = '{' + block + '}';
            const obj = JSON.parse(wrapped);
            // obj is { key: value }

            if (!keyMap.has(currentKey)) {
                keyMap.set(currentKey, []);
            }
            keyMap.get(currentKey).push(obj[currentKey]);
        } catch (e) {
            console.error(`Failed to parse block for key "${currentKey}":`, e.message);
            // Try to salvage if it's just a trailing comma or brace issue
            try {
                // Heuristic: if it fails, maybe we captured the file closing brace?
                // Strip last char if it is '}' and try again? 
                // No, safer to just log for now, or use the loop logic to be precise.
            } catch (e2) { }
        }
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Check for File start/end
        if (i === 0 && line.trim() === '{') continue;
        // Check for File end (Indent 0 closing brace)
        if (line === '}' || line.trim() === '}') {
            // Only if this looks like the file end (indent 0)
            if (!line.startsWith(' ')) continue;
        }

        const match = line.match(/^  "([^"]+)":/);

        if (match) {
            // New key found
            processBuffer();
            currentKey = match[1];
            buffer = [line];
        } else {
            if (currentKey) {
                buffer.push(line);
            }
        }
    }
    processBuffer(); // Process last key

    // Deep merge function
    function deepMerge(target, source) {
        if (typeof target !== 'object' || target === null || typeof source !== 'object' || source === null) {
            return source; // Primitive or null: overwrite
        }

        if (Array.isArray(target) && Array.isArray(source)) {
            return source;
        }

        if (Array.isArray(target) || Array.isArray(source)) return source;

        const output = { ...target };
        for (const key of Object.keys(source)) {
            if (key in target) {
                output[key] = deepMerge(target[key], source[key]);
            } else {
                output[key] = source[key];
            }
        }
        return output;
    }

    // Merge all values
    const finalObj = {};
    for (const [key, values] of keyMap.entries()) {
        let merged = values[0];
        for (let i = 1; i < values.length; i++) {
            merged = deepMerge(merged, values[i]);
        }
        finalObj[key] = merged;
    }

    return finalObj;
}

const files = ['locales/pt-BR.json', 'locales/en-US.json'];

files.forEach(f => {
    const p = path.resolve(process.cwd(), f);
    if (fs.existsSync(p)) {
        try {
            console.log(`Processing ${f}...`);
            const fixed = parseAndMerge(p);
            fs.writeFileSync(p, JSON.stringify(fixed, null, 2));
            console.log(`Fixed ${f}`);
        } catch (e) {
            console.error(`Error in ${f}:`, e);
        }
    }
});
