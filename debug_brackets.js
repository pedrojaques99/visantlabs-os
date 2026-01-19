const fs = require('fs');
const content = fs.readFileSync('src/pages/MockupMachinePage.tsx', 'utf8');
const lines = content.split('\n');
let balance = 0;
for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const oldBalance = balance;
    for (const char of line) {
        if (char === '{') balance++;
        if (char === '}') balance--;
    }
    if (balance < 0) {
        console.log(`Line ${i + 1}: Balance dropped below zero (${balance})`);
        break;
    }
}
console.log(`Final balance: ${balance}`);
