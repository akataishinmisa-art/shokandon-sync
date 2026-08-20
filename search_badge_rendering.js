const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'ebay-stock-monitor', 'frontend', 'app.js');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

lines.forEach((l, idx) => {
    if (l.includes('良品') || l.includes('ジャンク') || l.includes('発送') || l.includes('condition') || l.includes('badge')) {
        if (idx < 500 && (l.includes('良品') || l.includes('condition') || l.includes('shipping'))) {
            console.log(`Line ${idx+1}: ${l.substring(0, 120)}`);
        }
    }
});
