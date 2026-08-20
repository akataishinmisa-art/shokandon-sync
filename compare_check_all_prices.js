const fs = require('fs');

const appJs = fs.readFileSync('C:\\Users\\akata\\.gemini\\antigravity\\scratch\\ebay-stock-monitor\\frontend\\app.js', 'utf8');
const lines = appJs.split('\n');

console.log('=== 1. DETAIL MODAL: detail-btn-check-all-prices (Line 1115-1155) ===');
for (let i = 1115; i <= 1160; i++) {
    if (lines[i]) console.log(`${i+1}: ${lines[i]}`);
}

console.log('\n=== 2. FEED HEADER: btn-feed-check-all-prices (Line 1700-1740) ===');
for (let i = 1700; i <= 1740; i++) {
    if (lines[i]) console.log(`${i+1}: ${lines[i]}`);
}
