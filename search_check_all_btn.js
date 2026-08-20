const fs = require('fs');

const appJs = fs.readFileSync('C:\\Users\\akata\\.gemini\\antigravity\\scratch\\ebay-stock-monitor\\frontend\\app.js', 'utf8');
appJs.split('\n').forEach((line, i) => {
    if (line.includes('btn-check-all')) {
        console.log(`Line ${i+1}: ${line}`);
    }
});
