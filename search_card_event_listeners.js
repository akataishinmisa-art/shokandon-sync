const fs = require('fs');

const appJs = fs.readFileSync('C:\\Users\\akata\\.gemini\\antigravity\\scratch\\ebay-stock-monitor\\frontend\\app.js', 'utf8');
const lines = appJs.split('\n');

console.log('=== Event Listeners for btn-listing-item / btn-card-action in app.js ===');
lines.forEach((line, idx) => {
    if (line.includes('btn-listing-item') || line.includes('toggleListingItem') || line.includes('btn-card-action')) {
        console.log(`Line ${idx + 1}: ${line.trim()}`);
    }
});
