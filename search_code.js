const fs = require('fs');
const path = require('path');

const dir = __dirname;
const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));

files.forEach(file => {
    const content = fs.readFileSync(path.join(dir, file), 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, idx) => {
        if (line.includes('values[4]') || line.includes('newE') || line.includes('oldPrice') || line.includes('E列')) {
            console.log(`${file}:${idx + 1}: ${line.trim()}`);
        }
    });
});
