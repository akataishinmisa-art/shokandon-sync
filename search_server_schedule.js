const fs = require('fs');
const path = require('path');

const content = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
const lines = content.split('\n');
console.log("=== Matching lines in server.js ===");
lines.forEach((l, i) => {
    if (l.toLowerCase().includes('cron') || l.toLowerCase().includes('schedule') || l.toLowerCase().includes('saas_batch_engine') || l.includes('6:00') || l.includes('setInterval')) {
        console.log(`Line ${i+1}: ${l.substring(0, 100)}`);
    }
});
