const fs = require('fs');

const appJs = fs.readFileSync('C:\\Users\\akata\\.gemini\\antigravity\\scratch\\ebay-stock-monitor\\frontend\\app.js', 'utf8');
const lines = appJs.split('\n');

console.log('=== toggleSaveItem (Lines 1850-1895) ===');
for (let i = 1850; i <= 1895; i++) {
    console.log(`${i+1}: ${lines[i]}`);
}

console.log('\n=== toggleListingItem (Lines 1910-1940) ===');
for (let i = 1910; i <= 1940; i++) {
    console.log(`${i+1}: ${lines[i]}`);
}
