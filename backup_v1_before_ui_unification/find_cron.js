const fs = require('fs');
const content = fs.readFileSync('server.js', 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
    if (line.includes('cron') || line.includes('setInterval') || line.includes('AutoSchedule') || line.includes('8時台')) {
        console.log(`L${idx + 1}: ${line}`);
    }
});
