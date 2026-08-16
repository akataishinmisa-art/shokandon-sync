// Wrapper routing to the single unified engine saas_batch_engine.js with --mode=line_transfer
const { spawn } = require('child_process');
const path = require('path');

const targetScript = path.join(__dirname, 'saas_batch_engine.js');
console.log('🔄 Routing process_with_line_notify.js to Unified Engine saas_batch_engine.js (--mode=line_transfer)...');

const proc = spawn('node', [targetScript, '--mode=line_transfer', ...process.argv.slice(2)], {
    cwd: __dirname,
    stdio: 'inherit',
    env: process.env
});

proc.on('exit', (code) => {
    process.exit(code || 0);
});
