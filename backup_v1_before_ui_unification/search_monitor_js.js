const fs = require('fs');

const appJsPath = 'C:\\Users\\akata\\.gemini\\antigravity\\scratch\\ebay-stock-monitor\\frontend\\app.js';
const appJsContent = fs.readFileSync(appJsPath, 'utf8');

const targetIds = [
    'detail-btn-check-all-prices',
    'detail-btn-check-now',
    'btn-feed-check-all-prices',
    'btn-feed-check-now'
];

targetIds.forEach(id => {
    console.log(`=== Searching for: ${id} ===`);
    const lines = appJsContent.split('\n');
    lines.forEach((line, idx) => {
        if (line.includes(id)) {
            console.log(`Line ${idx + 1}: ${line.trim()}`);
            // print context lines
            for (let i = Math.max(0, idx - 2); i <= Math.min(lines.length - 1, idx + 10); i++) {
                console.log(`  ${i + 1}: ${lines[i]}`);
            }
        }
    });
    console.log('\n');
});
