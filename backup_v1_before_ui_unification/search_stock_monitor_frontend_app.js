const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'ebay-stock-monitor', 'frontend', 'app.js');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

console.log("Total lines in ebay-stock-monitor app.js:", lines.length);

lines.forEach((l, idx) => {
    if (l.includes('filter-target') || l.includes('filterTarget') || l.includes('detections') || l.includes('target_item_id') || l.includes('renderDetections')) {
        console.log(`Line ${idx+1}: ${l.substring(0, 120)}`);
    }
});
