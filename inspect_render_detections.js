const fs = require('fs');

const appJs = fs.readFileSync('C:\\Users\\akata\\.gemini\\antigravity\\scratch\\ebay-stock-monitor\\frontend\\app.js', 'utf8');
const lines = appJs.split('\n');

let start = -1;
lines.forEach((line, idx) => {
    if (line.includes('function renderDetections')) {
        start = idx;
    }
});

if (start !== -1) {
    console.log(`=== renderDetections function from line ${start + 1} ===`);
    for (let i = start; i <= start + 120 && i < lines.length; i++) {
        console.log(`${i + 1}: ${lines[i]}`);
    }
}
