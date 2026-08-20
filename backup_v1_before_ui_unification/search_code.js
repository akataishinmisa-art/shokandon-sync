const fs = require('fs');
const path = require('path');

function searchInDir(dir, query) {
    const files = fs.readdirSync(dir);
    for (const f of files) {
        const full = path.join(dir, f);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) {
            if (f !== 'node_modules' && f !== '.git') searchInDir(full, query);
        } else if (f.endsWith('.html') || f.endsWith('.js') || f.endsWith('.css')) {
            const content = fs.readFileSync(full, 'utf8');
            if (content.toLowerCase().includes(query.toLowerCase())) {
                console.log(`Found "${query}" in ${full}`);
            }
        }
    }
}

const targetDir = 'C:\\Users\\akata\\.gemini\\antigravity\\scratch';
console.log('Searching for button icons or actions...');
searchInDir(targetDir, '★');
searchInDir(targetDir, '📦');
searchInDir(targetDir, '🚫');
searchInDir(targetDir, 'star');
searchInDir(targetDir, 'box');
searchInDir(targetDir, 'ban');
searchInDir(targetDir, 'ng');
