const fs = require('fs');

const appJs = fs.readFileSync('C:\\Users\\akata\\.gemini\\antigravity\\scratch\\ebay-stock-monitor\\frontend\\app.js', 'utf8');
const lines = appJs.split('\n');

console.log('=== Lines 1700-1800 ===');
for (let i = 1700; i <= 1800; i++) {
    if (lines[i]) console.log(`${i+1}: ${lines[i]}`);
}
