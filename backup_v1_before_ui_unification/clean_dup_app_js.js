const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'ebay-stock-monitor', 'frontend', 'app.js');
let content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

// Line 1483 ~ 1501 の重複ブロックを削除
const cleanedLines = [];
let skip = false;

lines.forEach((l, idx) => {
    if (idx >= 1482 && idx <= 1500 && l.includes('editTargetBtn')) {
        return; // skip
    }
    if (idx >= 1482 && idx <= 1500 && (l.includes('const editTargetBtn') || l.includes('openTargetDetail') || l.includes('showToast("対象の商品を選択してください"'))) {
        return; // skip
    }
    cleanedLines.push(l);
});

fs.writeFileSync(filePath, cleanedLines.join('\n'), 'utf8');
console.log("Cleaned duplicate block successfully!");
