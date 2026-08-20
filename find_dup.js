const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'ebay-stock-monitor', 'frontend', 'app.js');
let content = fs.readFileSync(filePath, 'utf8');

// 二重宣言の editTargetBtn をひとつにまとめる
const lines = content.split('\n');
console.log("Lines before fix:", lines.length);

let firstEditTargetBtnLine = -1;
let secondEditTargetBtnLine = -1;

lines.forEach((l, idx) => {
    if (l.includes('const editTargetBtn = document.getElementById("btn-edit-current-target");')) {
        if (firstEditTargetBtnLine === -1) {
            firstEditTargetBtnLine = idx;
        } else {
            secondEditTargetBtnLine = idx;
        }
    }
});

console.log("First occurrence line:", firstEditTargetBtnLine + 1);
console.log("Second occurrence line:", secondEditTargetBtnLine + 1);
