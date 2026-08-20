const fs = require('fs');

const appPy = fs.readFileSync('C:\\Users\\akata\\.gemini\\antigravity\\scratch\\ebay-stock-monitor\\backend\\app.py', 'utf8');
const lines = appPy.split('\n');

console.log('=== Searching for listing/toggle_listing in app.py ===');
lines.forEach((line, idx) => {
    if (line.includes('listing') || line.includes('toggle')) {
        console.log(`Line ${idx + 1}: ${line.trim()}`);
    }
});
