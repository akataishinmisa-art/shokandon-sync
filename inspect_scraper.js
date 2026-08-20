const fs = require('fs');

const appPy = fs.readFileSync('C:\\Users\\akata\\.gemini\\antigravity\\scratch\\ebay-stock-monitor\\backend\\app.py', 'utf8');
console.log('=== APP.PY CHECK ROUTE ===');
appPy.split('\n').forEach((line, i) => {
    if (line.includes('check_target') || line.includes('/check')) {
        console.log(`Line ${i+1}: ${line}`);
    }
});

const scraperPy = fs.readFileSync('C:\\Users\\akata\\.gemini\\antigravity\\scratch\\ebay-stock-monitor\\backend\\scraper.py', 'utf8');
console.log('\n=== SCRAPER.PY FUNCTIONS ===');
scraperPy.split('\n').slice(0, 50).forEach((line, i) => {
    console.log(`Line ${i+1}: ${line}`);
});
