const fs = require('fs');

const appJs = fs.readFileSync('C:\\Users\\akata\\.gemini\\antigravity\\scratch\\ebay-stock-monitor\\frontend\\app.js', 'utf8');
appJs.split('\n').forEach((line, i) => {
    if (line.includes('updateTargetSelectOptions') || line.includes('function updateTarget')) {
        console.log(`Line ${i+1}: ${line}`);
    }
});
