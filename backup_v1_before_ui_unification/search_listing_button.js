const fs = require('fs');

const appJs = fs.readFileSync('C:\\Users\\akata\\.gemini\\antigravity\\scratch\\ebay-stock-monitor\\frontend\\app.js', 'utf8');
const lines = appJs.split('\n');

console.log('=== Searching for listing/出品中 in app.js ===');
lines.forEach((line, idx) => {
    if (line.includes('listing') || line.includes('出品中') || line.includes('filter-listing-only')) {
        console.log(`Line ${idx + 1}: ${line.trim()}`);
    }
});
