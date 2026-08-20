const fs = require('fs');

const appJsPath = 'C:\\Users\\akata\\.gemini\\antigravity\\scratch\\ebay-stock-monitor\\frontend\\app.js';
const appJsContent = fs.readFileSync(appJsPath, 'utf8');
const lines = appJsContent.split('\n');

console.log('=== 1. DETAIL MODAL BUTTONS (Line 1055-1155) ===');
for (let i = 1055; i <= 1155; i++) {
    console.log(`${i}: ${lines[i]}`);
}

console.log('\n=== 2. FEED HEADER BUTTONS (Line 1660-1740) ===');
for (let i = 1660; i <= 1740; i++) {
    console.log(`${i}: ${lines[i]}`);
}
