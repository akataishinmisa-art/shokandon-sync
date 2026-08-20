const fs = require('fs');

const appPy = fs.readFileSync('C:\\Users\\akata\\.gemini\\antigravity\\scratch\\ebay-stock-monitor\\backend\\app.py', 'utf8');
const lines = appPy.split('\n');

console.log('=== APP.PY STATIC MOUNT AND INDEX ROUTE ===');
lines.forEach((line, idx) => {
    if (line.includes('StaticFiles') || line.includes('index.html') || line.includes('frontend') || line.includes('mount')) {
        console.log(`Line ${idx + 1}: ${line}`);
    }
});
