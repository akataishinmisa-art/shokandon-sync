const fs = require('fs');

const appJs = fs.readFileSync('C:\\Users\\akata\\.gemini\\antigravity\\scratch\\ebay-stock-monitor\\frontend\\app.js', 'utf8');
const lines = appJs.split('\n');

lines.forEach((line, idx) => {
    if (line.includes('function showToast')) {
        console.log(`Line ${idx + 1}: ${line}`);
    }
});
