const fs = require('fs');

const appJs = fs.readFileSync('C:\\Users\\akata\\.gemini\\antigravity\\scratch\\ebay-stock-monitor\\frontend\\app.js', 'utf8');
const lines = appJs.split('\n');

console.log('=== CARD ACTION BAR HTML GENERATION (Lines 410-435) ===');
for (let i = 410; i <= 435; i++) {
    console.log(`${i+1}: ${lines[i]}`);
}
