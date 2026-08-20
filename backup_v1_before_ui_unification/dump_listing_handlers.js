const fs = require('fs');

const appJs = fs.readFileSync('C:\\Users\\akata\\.gemini\\antigravity\\scratch\\ebay-stock-monitor\\frontend\\app.js', 'utf8');
const lines = appJs.split('\n');

console.log('=== LISTING HANDLER CODE LINES 1650-1665 ===');
for (let i = 1650; i <= 1665; i++) {
    console.log(`${i}: ${lines[i]}`);
}

console.log('\n=== LISTING TOGGLE FUNCTION LINES 1900-1970 ===');
for (let i = 1900; i <= 1970; i++) {
    console.log(`${i}: ${lines[i]}`);
}

console.log('\n=== CARD BUTTON EVENT BINDING LINES 415-460 ===');
for (let i = 415; i <= 460; i++) {
    console.log(`${i}: ${lines[i]}`);
}
