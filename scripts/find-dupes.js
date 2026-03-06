#!/usr/bin/env node
// find-dupes.js — finds duplicate keys in JSON files
// Usage: node find-dupes.js [file1] [file2] ...
// Defaults to src/locales/pt-BR.json and src/locales/en-US.json if no args given.

import { readFileSync } from 'node:fs';

/**
 * Parse a JSON string and return a list of all duplicate keys found,
 * including their path within the object tree.
 *
 * Uses a custom recursive descent parser so we can intercept every key
 * in every object scope — JSON.parse() silently overwrites duplicates.
 */
function findDuplicates(jsonStr) {
    let pos = 0;
    const duplicates = [];

    function skipWhitespace() {
        while (pos < jsonStr.length && /\s/.test(jsonStr[pos])) pos++;
    }

    function parseString() {
        if (jsonStr[pos] !== '"') throw new Error(`Expected '"' at pos ${pos}`);
        pos++; // skip opening quote
        let result = '';
        while (pos < jsonStr.length) {
            const ch = jsonStr[pos];
            if (ch === '\\') {
                pos++;
                result += jsonStr[pos];
            } else if (ch === '"') {
                pos++; // skip closing quote
                return result;
            } else {
                result += ch;
            }
            pos++;
        }
        throw new Error('Unterminated string');
    }

    function parseValue(path) {
        skipWhitespace();
        const ch = jsonStr[pos];
        if (ch === '{') return parseObject(path);
        if (ch === '[') return parseArray(path);
        if (ch === '"') return parseString();
        // numbers, booleans, null
        const match = jsonStr.slice(pos).match(/^(-?\d+\.?\d*(?:[eE][+-]?\d+)?|true|false|null)/);
        if (match) { pos += match[0].length; return; }
        throw new Error(`Unexpected token '${ch}' at pos ${pos}`);
    }

    function parseObject(path) {
        pos++; // skip '{'
        const seen = new Set();
        skipWhitespace();
        if (jsonStr[pos] === '}') { pos++; return; }
        while (pos < jsonStr.length) {
            skipWhitespace();
            const key = parseString();
            const keyPath = path ? `${path}.${key}` : key;

            if (seen.has(key)) {
                duplicates.push({ key, path: keyPath });
            }
            seen.add(key);

            skipWhitespace();
            if (jsonStr[pos] !== ':') throw new Error(`Expected ':' at pos ${pos}, got '${jsonStr[pos]}'`);
            pos++;
            parseValue(keyPath);

            skipWhitespace();
            if (jsonStr[pos] === ',') { pos++; continue; }
            if (jsonStr[pos] === '}') { pos++; return; }
            throw new Error(`Expected ',' or '}' at pos ${pos}`);
        }
    }

    function parseArray(path) {
        pos++; // skip '['
        skipWhitespace();
        if (jsonStr[pos] === ']') { pos++; return; }
        let idx = 0;
        while (pos < jsonStr.length) {
            parseValue(`${path}[${idx++}]`);
            skipWhitespace();
            if (jsonStr[pos] === ',') { pos++; continue; }
            if (jsonStr[pos] === ']') { pos++; return; }
            throw new Error(`Expected ',' or ']' at pos ${pos}`);
        }
    }

    parseValue('');
    return duplicates;
}

function checkFile(filename) {
    let content;
    try {
        content = readFileSync(filename, 'utf-8');
    } catch (err) {
        console.error(`Error reading ${filename}: ${err.message}`);
        return;
    }

    let dupes;
    try {
        dupes = findDuplicates(content);
    } catch (err) {
        console.error(`Parse error in ${filename}: ${err.message}`);
        return;
    }

    if (dupes.length === 0) {
        console.log(`✓ ${filename} — no duplicates found`);
    } else {
        console.log(`\n✗ ${filename} — ${dupes.length} duplicate(s):`);
        dupes.forEach(d => console.log(`  "${d.key}"  (path: ${d.path})`));
    }
}

const files = process.argv.slice(2);
if (files.length === 0) {
    // Default targets
    ['src/locales/pt-BR.json', 'src/locales/en-US.json'].forEach(checkFile);
} else {
    files.forEach(checkFile);
}
