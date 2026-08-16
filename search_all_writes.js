const fs = require('fs');
const path = require('path');

const dir = __dirname;
const files = fs.readdirSync(dir).filter(f => f.endsWith('.js') || f.endsWith('.json'));

console.log('=== SEARCHING ALL SHEET WRITES IN ALL JS FILES ===\n');

files.forEach(file => {
    const content = fs.readFileSync(path.join(dir, file), 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, idx) => {
        if (line.includes('values.update') || line.includes('values.batchUpdate') || line.includes('valueInputOption') || line.includes('requestBody') || line.includes('range:')) {
            console.log(`${file}:${idx + 1}: ${line.trim()}`);
        }
    });
});
