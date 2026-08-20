const fs = require('fs');

const appJsContent = fs.readFileSync('C:\\Users\\akata\\.gemini\\antigravity\\scratch\\ebay-stock-monitor\\frontend\\app.js', 'utf8');
const lines = appJsContent.split('\n');

lines.forEach((line, i) => {
    if (line.includes('detail-btn-view-detections') || line.includes('detail-btn-back-list')) {
        console.log(`Line ${i+1}: ${line}`);
        for (let j = Math.max(0, i-2); j <= Math.min(lines.length-1, i+15); j++) {
            console.log(`  ${j+1}: ${lines[j]}`);
        }
    }
});
