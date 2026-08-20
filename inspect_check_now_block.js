const fs = require('fs');

const appJs = fs.readFileSync('C:\\Users\\akata\\.gemini\\antigravity\\scratch\\ebay-stock-monitor\\frontend\\app.js', 'utf8');
const lines = appJs.split('\n');

console.log('=== LINES 1080-1220 ===');
for (let i = 1080; i <= 1220; i++) {
    if (lines[i]) console.log(`${i+1}: ${lines[i]}`);
}
