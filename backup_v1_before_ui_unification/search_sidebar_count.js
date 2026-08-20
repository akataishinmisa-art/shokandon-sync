const fs = require('fs');

const appJs = fs.readFileSync('C:\\Users\\akata\\.gemini\\antigravity\\scratch\\ebay-stock-monitor\\frontend\\app.js', 'utf8');
appJs.split('\n').forEach((line, i) => {
    if (line.includes('targets-count') || line.includes('sidebar-targets-count') || line.includes('sublist')) {
        console.log(`Line ${i+1}: ${line}`);
    }
});

const indexHtml = fs.readFileSync('C:\\Users\\akata\\.gemini\\antigravity\\scratch\\ebay-stock-monitor\\frontend\\index.html', 'utf8');
indexHtml.split('\n').forEach((line, i) => {
    if (line.includes('登録商品リスト') || line.includes('targets-sublist')) {
        console.log(`Index Line ${i+1}: ${line}`);
    }
});
