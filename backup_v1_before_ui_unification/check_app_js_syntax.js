const fs = require('fs');
const path = require('path');

const appJsPath = 'C:\\Users\\akata\\.gemini\\antigravity\\scratch\\ebay-stock-monitor\\frontend\\app.js';
const appJsCode = fs.readFileSync(appJsPath, 'utf8');

console.log('=== APP.JS SYNTAX CHECK ===');
try {
    // Basic Function Constructor Syntax Check
    new Function(appJsCode);
    console.log('✅ app.js Syntax Check PASSED! No syntax errors.');
} catch (e) {
    console.error('❌ app.js Syntax Error Found:', e.message);
    console.error('Stack:', e.stack);
}
