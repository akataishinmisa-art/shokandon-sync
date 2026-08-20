const fs = require('fs');

const code = fs.readFileSync('C:\\Users\\akata\\.gemini\\antigravity\\scratch\\ebay-stock-monitor\\frontend\\app.js', 'utf8');
const lines = code.split('\n');

for (let i = 1; i <= lines.length; i++) {
    const chunk = lines.slice(0, i).join('\n');
    try {
        new Function(chunk);
    } catch(e) {
        if (!e.message.includes('Unexpected end of input')) {
            console.log(`Error line ~${i}: ${e.message}`);
            console.log('Context lines:');
            for (let k = Math.max(0, i-5); k < Math.min(lines.length, i+5); k++) {
                console.log(`${k+1}: ${lines[k]}`);
            }
            break;
        }
    }
}
