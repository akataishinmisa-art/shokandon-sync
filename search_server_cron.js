const fs = require('fs');
const content = fs.readFileSync('server.js', 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
    if (line.includes('setInterval') || line.includes('cron') || line.includes('saas_batch') || line.includes('run_current') || line.includes('process_')) {
        console.log(`server.js:${idx + 1}: ${line.trim()}`);
    }
});
