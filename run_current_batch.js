// Wrapper routing to the single unified engine saas_batch_engine.js
const { spawn } = require('child_process');
const path = require('path');

const targetScript = path.join(__dirname, 'saas_batch_engine.js');
console.log('🔄 Routing run_current_batch.js to Unified Engine saas_batch_engine.js...');

const proc = spawn('node', [targetScript, ...process.argv.slice(2)], {
    cwd: __dirname,
    stdio: 'inherit',
    env: process.env
});

proc.on('exit', (code) => {
    process.exit(code || 0);
});
