const fs = require('fs');
const path = require('path');

const content = fs.readFileSync(path.join(__dirname, 'public', 'app.js'), 'utf8');
const lines = content.split('\n');
console.log("Total lines in app.js:", lines.length);

lines.forEach((line, idx) => {
    if (line.includes('New 3DS') || line.includes('ピックアップ') || line.includes('filter') || line.includes('keyword') || line.includes('render')) {
        if (idx < 200 || line.includes('ピックアップ') || line.includes('keyword') || line.includes('New 3DS')) {
            console.log(`Line ${idx + 1}: ${line.substring(0, 120)}`);
        }
    }
});
